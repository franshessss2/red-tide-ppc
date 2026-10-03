import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap, Polygon as LeafletPolygon } from 'leaflet'
import { useReducedMotion } from '../motion/preferences'
import { cameraFor } from '../motion/camera'
import { createMotionScope } from '../motion/scope'
import { MOTION } from '../motion/tokens'
import { MapMotionPolicy } from './MapMotionPolicy'
import { MapContainer, Pane, Polygon, TileLayer, useMap } from 'react-leaflet'
import { MAP_CENTER, MAP_DEFAULT_ZOOM, MAP_MAX_BOUNDS, zonesBoundingBox } from '../data/zones'
import {
  FOCUS_FLIGHT_SECONDS,
  ZONE_LOAD_DURATION_MS,
  focusPaddingFor,
  zoneLoadDelayMs,
} from '../motion/mapMotion'
import { ZONE_CASING, zonePaint, zoneTheme } from '../styles/statusTheme'
import { ReportPins, UserLocationDot } from './MapMarkers'
import '../styles/map-motion.css'
// `LatLng` here is our own [lat, lng] tuple, which Leaflet accepts directly.
import type { LatLng, Report, Zone, ZoneStatus } from '../types'
import { ShippingLayer } from './ShippingLayer'

export interface MapProps {
  zones: Zone[]
  /** Live report feed — pins land on zone centroids (see MapMarkers.tsx). */
  reports: Report[]
  selectedZoneId: string | null
  /** Bump this to re-fit the view on every zone (the "Reset view" button). */
  resetToken: number
  /** Zone to zoom to when it is picked from the list below the map. */
  focusZoneId: string | null
  /** Bump this together with `focusZoneId` to trigger the zoom. */
  focusToken: number
  /**
   * Show the shipping-channel (PCG PPTSS) navigation-hazard overlay. Off by
   * default: it is a secondary safety reference, not the app's purpose.
   */
  shippingLanesVisible?: boolean
  /** Opacity 0→1 for fade-in/out, driven by MapPage. */
  shippingOpacity?: number
  /**
   * Right-edge reservation (px) the focus flight must keep clear — the open
   * zone drawer on desktop. MapPage owns the drawer state and passes the
   * matching constant from `motion/mapMotion.ts`.
   */
  focusReserveRight?: number
  /**
   * Hands the live Leaflet instance up once mounted, so the control column
   * can drive zoom from its own buttons (Leaflet's zoom control is not
   * rendered — see below).
   */
  onMapReady?: (map: LeafletMap) => void
  onClearSelection?: () => void
  onTileStatus?: (status: 'loading' | 'ready' | 'error') => void
  tileRetry?: number
  onSelectZone: (zoneId: string) => void
}

/**
 * Pane for the zone boundary casings. Leaflet's default `overlayPane` sits at
 * z-index 400; this one is created just below it so every casing stroke is
 * painted under every zone fill and status stroke, never over a neighbour's.
 * (Custom panes get their own SVG root, so `.leaflet-overlay-pane path` still
 * selects exactly the interactive zone polygons — the tests rely on that.)
 */
const ZONE_CASING_PANE = 'zoneCasingPane'

const SVG_NS = 'http://www.w3.org/2000/svg'
/** Matches `@keyframes zone-ping` (600ms) plus a little slack for cleanup. */
const ZONE_PING_MS = MOTION.time.pulse * 1000 + 80
/**
 * Status-change fill wash. ~0.6 is above every resting fill (0.34–0.42) and
 * under the advisory selected step (0.64), so the flash reads without
 * looking selected. The decay is longer than the stylesheet's 200ms
 * fill-opacity ramp, which would otherwise swallow it.
 */
const STATUS_WASH_FILL = 0.6
const STATUS_WASH_MS = MOTION.time.wash * 1000

/** Fires a one-shot sonar ring for a tapped zone. No-op under reduced motion. */
type ZonePing = (layer: LeafletPolygon, status: ZoneStatus) => void

/**
 * Leaflet's overlay renderer is an SVG whose viewBox is in layer points.
 * The ring has to live in *that* SVG — the one that owns the clicked path —
 * not the first `<svg>` in the overlay pane. Shipping lines and the casing
 * pane can each insert an earlier SVG; a pane-wide query would put the ring
 * in the wrong user space. A React node outside the map would not track the
 * pane at all.
 */
function zoneRendererRoot(layer: LeafletPolygon): Element | null {
  const path = layer.getElement()
  if (!path) return null

  // Duck-typed: jsdom does not always expose SVGElement, but `closest` and
  // `ownerSVGElement` are stable where the renderer actually runs.
  const owner = (path as { ownerSVGElement?: Element | null }).ownerSVGElement
  const svg = (owner instanceof Element ? owner : null) ?? path.closest('svg')
  if (!svg) return null

  // Paths are appended to the renderer's root `<g>` (`_rootGroup`). Walk up
  // and keep the group whose parent is that SVG.
  let node: Element | null = path.parentElement
  let rootGroup: Element | null = null
  while (node && node !== svg) {
    if (node.namespaceURI === SVG_NS && node.tagName.toLowerCase() === 'g') {
      rootGroup = node
    }
    node = node.parentElement
  }
  return rootGroup ?? svg
}

/**
 * Sonar ping on zone tap. One ring at a time: a new tap cancels the previous
 * ring before it finishes. The node removes itself on `animationend` (and on
 * a timeout, so a skipped animation cannot leak). Reduced motion selects the
 * zone and draws nothing.
 */
function ZonePingBridge({ fireRef }: { fireRef: { current: ZonePing } }) {
  const map = useMap()
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    let active: ReturnType<typeof createMotionScope> | null = null
    const cancel = () => { active?.dispose(); active = null }

    fireRef.current = (layer, status) => {
      if (reduceMotion) return
      const root = zoneRendererRoot(layer)
      if (!root) return

      // Bounds centre, not a stored centroid — the polygon is the source.
      const point = map.latLngToLayerPoint(layer.getBounds().getCenter())
      cancel()

      const circle = document.createElementNS(SVG_NS, 'circle')
      circle.setAttribute('class', 'zone-ping')
      circle.setAttribute('cx', String(point.x))
      circle.setAttribute('cy', String(point.y))
      circle.setAttribute('r', '20')
      circle.setAttribute('fill', 'none')
      circle.setAttribute('stroke', zoneTheme(status).hex)
      circle.setAttribute('stroke-width', '1.5')
      circle.setAttribute('opacity', '0.7')
      circle.setAttribute('pointer-events', 'none')
      root.appendChild(circle)
      const scope = createMotionScope()
      active = scope
      scope.own(() => circle.remove())

      const cleanup = () => scope.dispose()
      circle.addEventListener('animationend', cleanup)
      scope.own(() => circle.removeEventListener('animationend', cleanup))
      scope.timeout(cleanup, ZONE_PING_MS)
    }

    return () => {
      fireRef.current = () => {}
      cancel()
    }
  }, [map, reduceMotion, fireRef])

  return null
}

/** Publishes the Leaflet instance to the page chrome once the map mounts. */
function MapReadyBridge({
  onMapReady,
}: {
  onMapReady?: (map: LeafletMap) => void
}) {
  const map = useMap()

  useEffect(() => {
    onMapReady?.(map)
  }, [map, onMapReady])

  return null
}

/** Fits the map to the zones the first time they arrive. */
function FitToBounds({
  box,
  resetToken,
  reserveRightPx,
}: {
  box: [LatLng, LatLng] | null
  resetToken: number
  reserveRightPx: number
}) {
  const map = useMap()
  const lastReset = useRef<number | null>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!box) return
    if (lastReset.current === resetToken) return
    const initial = lastReset.current === null
    lastReset.current = resetToken
    const padding = focusPaddingFor(map.getSize().x, reserveRightPx)
    const settle = () => map.fitBounds(box, { ...padding, maxZoom: 12, animate: false })
    cameraFor(map).run(
      () => map.fitBounds(box, { ...padding, maxZoom: 12, animate: !reduceMotion && !initial, duration: MOTION.time.camera }),
      settle, !reduceMotion && !initial,
    )
  }, [box, map, resetToken, reduceMotion, reserveRightPx])

  return null
}

/**
 * Zooms to a single zone, but only when a focus was explicitly requested
 * (the list below the map bumps `token`).
 *
 * Gating on the token matters: tapping a polygon on the map also sets
 * `selectedZoneId`, which changes the `zone` prop. Without the token guard
 * every map tap would re-fit the view and yank the popup out from under the
 * user's finger.
 *
 * CAMERA FLIGHT
 * -------------
 * The move is a `flyToBounds` glide (0.9s) rather than a hard fit: the
 * travel reads as "the map took you there". Padding comes from
 * `focusPaddingFor` — at ≥768px it reserves the right edge for the zone
 * drawer (`reserveRightPx`), so the focused zone never hides behind the
 * panel; on phones the drawer tucks itself on focus (see MapPage), so only
 * the header strip and the attribution pill need clearance. Reduced motion
 * jumps with `fitBounds` instead of flying.
 */
function FocusZone({
  zone,
  token,
  reserveRightPx,
}: {
  zone: Zone | null
  token: number
  reserveRightPx: number
}) {
  const map = useMap()
  const reduceMotion = useReducedMotion()
  const lastToken = useRef(0)

  useEffect(() => {
    if (!zone || token === 0 || token === lastToken.current) return
    lastToken.current = token
    const focusBox = zonesBoundingBox([zone.polygon])
    if (!focusBox) return

    const { paddingTopLeft, paddingBottomRight } = focusPaddingFor(
      map.getSize().x,
      reserveRightPx,
    )
    const fitOptions = {
      paddingTopLeft,
      paddingBottomRight,
      maxZoom: 13,
    }
    const settle = () => map.fitBounds(focusBox, { ...fitOptions, animate: false })
    cameraFor(map).run(
      reduceMotion ? settle : () => map.flyToBounds(focusBox, { ...fitOptions, animate: true, duration: FOCUS_FLIGHT_SECONDS }),
      settle, !reduceMotion,
    )
  }, [zone, token, map, reserveRightPx, reduceMotion])

  return null
}

/**
 * The loop gate: pauses every looping map animation while the camera moves.
 *
 * Decorative loops (the advisory stroke pulse, the dash march — and in later
 * phases the location halo) must not compete with pan/zoom for paint time,
 * and freezing them mid-flight is what makes the map feel composed instead
 * of busy. Implementation is a single class on the Leaflet container that
 * CSS's `animation-play-state: paused` keys off (`map-motion.css`): play
 * state — not `animation: none` — so a resumed loop continues from its
 * current phase instead of restarting with a visible jump.
 */
function MapLoopGate() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    let moving = false
    let zooming = false
    const sync = () => {
      const paused = moving || zooming || document.hidden
      container.classList.toggle('map-motion-paused', paused)
      document.body.classList.toggle('map-motion-paused', paused)
    }
    const moveStart = () => { moving = true; sync() }
    const moveEnd = () => { moving = false; sync() }
    const zoomStart = () => { zooming = true; sync() }
    const zoomEnd = () => { zooming = false; sync() }
    map.on('movestart', moveStart).on('moveend', moveEnd).on('zoomstart', zoomStart).on('zoomend', zoomEnd)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      map.off('movestart', moveStart).off('moveend', moveEnd).off('zoomstart', zoomStart).off('zoomend', zoomEnd)
      document.removeEventListener('visibilitychange', sync)
      container.classList.remove('map-motion-paused')
      document.body.classList.remove('map-motion-paused')
    }
  }, [map])

  return null
}

/**
 * Is `target` an SVG `<path>` in the SVG namespace?
 *
 * Duck-typed instead of `instanceof SVGPathElement` — jsdom (where the
 * regression tests run) does not define that global, while `namespaceURI`
 * and `tagName` are spec'd and stable in every environment.
 */
function isZonePath(target: EventTarget | null): target is SVGPathElement {
  return (
    target instanceof Element &&
    target.namespaceURI === 'http://www.w3.org/2000/svg' &&
    target.tagName === 'path'
  )
}

/**
 * Lights the polygon under the pointer from the moment the press starts.
 *
 * Thin SVG strokes have a slow `fill-opacity` ramp (200ms, see index.css), and
 * the whole point of that ramp is that it plays *before* the popup opens. On
 * mouse it does: `mouseover` arrives well ahead of `click`. On touch it does
 * not — Leaflet's container listens for mouse events only, so a tap is
 * delivered as a synthesised mouseover/mousedown/mouseup/click burst at
 * `touchend`, 110ms+ after the finger actually landed. Measured in this app:
 * touchdown t=18ms, the layer's first event t=131ms.
 *
 * So the press state comes from the native `pointerdown`, which does fire with
 * the touch. The listener is delegated on the map container and runs in the
 * capture phase, so it cannot be affected by — and cannot affect — Leaflet's
 * own event plumbing. It only toggles a class; the ramp stays in CSS.
 *
 * A press that turns into a pan is released as soon as the pointer travels past
 * the slop, so dragging the map across a polygon does not leave it lit.
 */
function ZonePressFeedback() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    let pressed: SVGPathElement | null = null
    let origin: { x: number; y: number } | null = null

    function cleanup() {
      pressed?.classList.remove('zone-path--pressed')
      pressed = null
      origin = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
    }

    function onPointerMove(event: PointerEvent) {
      if (!origin) return
      // A few pixels of finger jitter must not cancel the press; anything
      // further is a map pan, not a tap.
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) {
        cleanup()
      }
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (!isZonePath(target)) return
      if (!target.classList.contains('zone-path')) return
      cleanup()
      pressed = target
      origin = { x: event.clientX, y: event.clientY }
      target.classList.add('zone-path--pressed')
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', cleanup)
      window.addEventListener('pointercancel', cleanup)
    }

    container.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => {
      container.removeEventListener('pointerdown', onPointerDown, { capture: true })
      cleanup()
    }
  }, [map])

  return null
}

/**
 * Fine-pointer hover glow over zone polygons.
 *
 * The polygon fill already lifts on hover; this adds the higher-level cursor
 * affordance without putting pointer coordinates in React state. Leaflet owns
 * the SVG paths, so the bridge delegates native pointer events from the map
 * container, writes CSS variables (`--map-hover-x/y/color`) directly onto that
 * container, and lets `map-motion.css` paint a tiny pointer-transparent radial
 * gradient. No zone geometry or render cycle is involved.
 */
function ZoneHoverGlowBridge() {
  const map = useMap()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const container = map.getContainer()
    const canHover =
      !reduceMotion &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches

    if (!canHover) {
      container.classList.remove('map-zone-hover-glow', 'map-zone-hover-glow-active')
      return
    }

    let raf: number | undefined
    let latestPoint: { x: number; y: number } | null = null

    function cleanupFrame() {
      if (raf !== undefined) {
        window.cancelAnimationFrame(raf)
        raf = undefined
      }
      latestPoint = null
    }

    function clearGlow() {
      container.classList.remove('map-zone-hover-glow-active')
    }

    function zoneStatusFor(target: SVGPathElement): ZoneStatus | null {
      const status = target.dataset.zoneStatus
      return status === 'safe' || status === 'unconfirmed' || status === 'advisory'
        ? status
        : null
    }

    function activateGlow(target: SVGPathElement) {
      const status = zoneStatusFor(target)
      if (!status) return
      container.style.setProperty('--map-hover-color', zoneTheme(status).hex)
      container.classList.add('map-zone-hover-glow-active')
    }

    function schedulePosition(event: PointerEvent) {
      latestPoint = { x: event.clientX, y: event.clientY }
      if (raf !== undefined) return
      raf = window.requestAnimationFrame(() => {
        raf = undefined
        if (!latestPoint) return
        const rect = container.getBoundingClientRect()
        container.style.setProperty('--map-hover-x', `${latestPoint.x - rect.left}px`)
        container.style.setProperty('--map-hover-y', `${latestPoint.y - rect.top}px`)
      })
    }

    function pathFromEvent(event: PointerEvent): SVGPathElement | null {
      const target = event.target
      if (!isZonePath(target)) return null
      return target.classList.contains('zone-path') ? target : null
    }

    function onPointerMove(event: PointerEvent) {
      const target = pathFromEvent(event)
      if (!target) {
        clearGlow()
        return
      }
      activateGlow(target)
      schedulePosition(event)
    }

    function onPointerOut(event: PointerEvent) {
      const next = event.relatedTarget
      if (
        isZonePath(next) &&
        next.classList.contains('zone-path')
      ) {
        return
      }
      clearGlow()
    }

    container.classList.add('map-zone-hover-glow')
    container.addEventListener('pointermove', onPointerMove, { passive: true })
    container.addEventListener('pointerout', onPointerOut, { passive: true })
    container.addEventListener('pointerleave', clearGlow, { passive: true })

    return () => {
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerout', onPointerOut)
      container.removeEventListener('pointerleave', clearGlow)
      cleanupFrame()
      container.classList.remove('map-zone-hover-glow', 'map-zone-hover-glow-active')
      container.style.removeProperty('--map-hover-x')
      container.style.removeProperty('--map-hover-y')
      container.style.removeProperty('--map-hover-color')
    }
  }, [map, reduceMotion])

  return null
}

/**
 * One zone polygon, with its modifier classes kept in sync imperatively.
 *
 * WHY THE CLASS APPLICATION IS SPLIT IN TWO
 * -----------------------------------------
 * `className="zone-path"` is a *constructor* prop: Leaflet's SVG renderer
 * reads `options.className` exactly once, in `_initPath`, when the path node
 * is created as the layer is added to the map. It never re-applies it — and
 * react-leaflet applies `pathOptions` via `setStyle` *after* the layer exists,
 * and `setStyle` only writes stroke/fill presentation attributes, never the
 * class. So `pathOptions.className` (the old code) silently never reached the
 * DOM in a production single-pass render: it only appeared in dev because
 * StrictMode's double effect invocation re-added the layer, re-running
 * `_initPath` against options that the first `setStyle` had already stored.
 * That is the regression `Map.test.tsx` guards.
 *
 * The runtime modifiers can't be constructor props (they change over the
 * layer's life), so they are toggled on the path element directly from a
 * layer ref. In the normal single pass the path already exists by the time
 * this component's effect runs (children's effects commit before the
 * parent's), but on StrictMode remounts — and any map remount — Leaflet
 * creates a fresh path node: the base class comes back from the constructor
 * options, the imperative modifiers do not, so the `add` subscription
 * re-applies them.
 *
 * THE MODIFIERS
 * -------------
 *  - `--selected`  the current selection (stroke thickens via pathOptions);
 *  - `--dimmed`    every NON-selected polygon while a selection exists —
 *                  element opacity 0.6, so the chosen zone stands out;
 *  - `--advisory`  advisory polygons: slow stroke pulse + marching dash
 *                  (pure CSS, `map-motion.css` — strokes only);
 *  - `--advisory-breathe` the same polygons' fill, a separate class so the
 *                  breathe rule can restate the stroke animations instead of
 *                  replacing them. CSS holds it off while loading, selected,
 *                  or pressed;
 *  - `--loading`   the one-shot load-in fade, added when the layer enters
 *                  the map and removed on `animationend` so its `both` fill
 *                  can never pin a stale fill-opacity over a later status
 *                  change. The per-zone stagger arrives as a custom property
 *                  (`--zone-delay`), not a per-zone selector.
 *
 * A status change also flashes the new colour's fill to 0.6 and decays to
 * the resting level over 800ms (`statusWash`). The colour crossfade itself
 * stays the 400ms CSS transition in `map-motion.css` — the wash only borrows
 * the element's inline `transition` for that window, then clears it.
 */
function ZonePolygon({
  zone,
  isSelected,
  isDimmed,
  isHovered,
  staggerIndex,
  onSelectZone,
  onHover,
  onLeave,
  pingRef,
}: {
  zone: Zone
  isSelected: boolean
  isDimmed: boolean
  isHovered: boolean
  /** Position in the zone list; drives the load-in stagger delay. */
  staggerIndex: number
  onSelectZone: (zoneId: string) => void
  onHover: (zoneId: string) => void
  onLeave: (zoneId: string) => void
  /**
   * Written by `ZonePingBridge` after mount. Read at click time so the first
   * render's no-op is not captured into the handler.
   */
  pingRef: { current: ZonePing }
}) {
  const reduceMotion = useReducedMotion()
  const layerRef = useRef<LeafletPolygon | null>(null)
  // Seeded with the mount status so the first paint is not a wash.
  const prevStatusRef = useRef(zone.status)
  const interactionRef = useRef({ isSelected, isHovered })
  interactionRef.current = { isSelected, isHovered }
  const modifiersRef = useRef({
    selected: isSelected,
    dimmed: isDimmed,
    advisory: zone.status === 'advisory',
    status: zone.status,
  })
  modifiersRef.current = {
    selected: isSelected,
    dimmed: isDimmed,
    advisory: zone.status === 'advisory',
    status: zone.status,
  }

  const syncModifierClasses = () => {
    const el = layerRef.current?.getElement()
    if (!el) return
    el.classList.toggle('zone-path--selected', modifiersRef.current.selected)
    el.classList.toggle('zone-path--dimmed', modifiersRef.current.dimmed)
    el.classList.toggle('zone-path--advisory', modifiersRef.current.advisory)
    el.classList.toggle(
      'zone-path--advisory-breathe',
      modifiersRef.current.advisory,
    )
    el.setAttribute('data-zone-status', modifiersRef.current.status)
  }

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    // Path not created yet (map not added) — the `add` listener applies it
    // the moment it is.
    syncModifierClasses()
    layer.on('add', syncModifierClasses)
    return () => {
      layer.off('add', syncModifierClasses)
    }
  }, [])

  useEffect(() => {
    syncModifierClasses()
  }, [isSelected, isDimmed, zone.status])

  // One owner for the listener and fallback. Reduced motion also clears a
  // partially completed fade; animationend is not guaranteed to fire.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    let active: ReturnType<typeof createMotionScope> | null = null
    const applyLoadIn = () => {
      active?.dispose()
      const el = layer.getElement() as SVGPathElement | undefined
      if (!el || reduceMotion) return
      const scope = createMotionScope()
      active = scope
      const delay = zoneLoadDelayMs(staggerIndex)
      el.style.setProperty('--zone-delay', `${delay}ms`)
      el.classList.add('zone-path--loading')
      const done = (event: AnimationEvent) => { if (event.animationName === 'zone-load-in') scope.dispose() }
      el.addEventListener('animationend', done)
      scope.own(() => { el.classList.remove('zone-path--loading'); el.removeEventListener('animationend', done) })
      scope.timeout(() => scope.dispose(), delay + ZONE_LOAD_DURATION_MS + 80)
    }
    applyLoadIn()
    layer.on('add', applyLoadIn)
    return () => { layer.off('add', applyLoadIn); active?.dispose() }
  }, [reduceMotion, staggerIndex])

  // Status colour-wash. Mount does not flash — `prevStatusRef` starts at the
  // current status. A later change snaps fill-opacity to 0.6 (new colour) and
  // decays to the resting level over 800ms. The inline transition restates
  // the 400ms fill/stroke crossfade so this override does not cut the colour
  // change down to the stylesheet's 200ms fill-opacity ramp, then clears so
  // hover/press get that ramp back. Reduced motion leaves the colour cut
  // instant (the CSS `transition: none` rule) and skips the flash.
  useEffect(() => {
    const previous = prevStatusRef.current
    if (previous === zone.status) return
    prevStatusRef.current = zone.status

    const layer = layerRef.current
    if (!layer) return

    const paintNow = zonePaint(zone.status)
    const restingFill = () => {
      const { isSelected: selected, isHovered: hovered } = interactionRef.current
      return selected
        ? paintNow.fillSelected
        : hovered
          ? paintNow.fillHover
          : paintNow.fill
    }

    if (reduceMotion) {
      layer.setStyle({
        color: paintNow.hex,
        fillColor: paintNow.hex,
        fillOpacity: restingFill(),
      })
      return
    }

    const el = layer.getElement() as SVGPathElement | undefined
    const colour =
      'fill var(--motion-reveal) var(--ease-out-quint), stroke var(--motion-reveal) var(--ease-out-quint)'
    const rest =
      'stroke-width var(--motion-base) var(--ease-out-quint), stroke-opacity var(--motion-base) var(--ease-out-quint), opacity var(--motion-base) var(--ease-out-quint)'

    if (el) el.style.transition = `${colour}, fill-opacity 0s, ${rest}`
    layer.setStyle({
      color: paintNow.hex,
      fillColor: paintNow.hex,
      fillOpacity: STATUS_WASH_FILL,
    })
    // Commit 0.6 before the decay starts, or the browser collapses both
    // writes into one transition and the flash never paints.
    el?.getBoundingClientRect()
    if (el) {
      el.style.transition = `${colour}, fill-opacity ${STATUS_WASH_MS}ms var(--ease-out-quint), ${rest}`
    }
    layer.setStyle({ fillOpacity: restingFill() })

    const timer = window.setTimeout(() => {
      if (el) el.style.transition = ''
    }, STATUS_WASH_MS + 40)

    return () => {
      window.clearTimeout(timer)
      if (el) el.style.transition = ''
      layer.setStyle({
        color: paintNow.hex,
        fillColor: paintNow.hex,
        fillOpacity: restingFill(),
      })
    }
  }, [zone.status, reduceMotion])

  const paint = zonePaint(zone.status)
  const weight = isSelected ? paint.weightSelected : paint.weight

  return (
    <>
      {/* Boundary casing — see `ZONE_CASING` in styles/statusTheme.ts. A
          non-interactive copy of the ring in the pane *under* the zone
          polygons, stroked in the ground colour and slightly wider than the
          status stroke, so every outline is flanked by a dark halo. Two
          touching same-status zones share one teal seam, but each now has its
          own dark edge on its side of it, so the seam reads as a boundary
          instead of dissolving into one continuous fill. */}
      <Polygon
        positions={zone.polygon}
        pane={ZONE_CASING_PANE}
        className="zone-casing"
        interactive={false}
        pathOptions={{
          color: ZONE_CASING.hex,
          weight: weight + ZONE_CASING.extraWeight,
          opacity: ZONE_CASING.opacity,
          fill: false,
          lineJoin: 'round',
        }}
      />
    <Polygon
      ref={layerRef}
      positions={zone.polygon}
      // Constructor prop — applied by Leaflet when the path is created.
      className="zone-path"
      bubblingMouseEvents={false}
      pathOptions={{
        color: paint.hex,
        fillColor: paint.hex,
        weight,
        // Per-status outline strength (see `strokeOpacity` in statusTheme.ts):
        // `safe` recedes, everything else holds the default 0.95.
        opacity: paint.strokeOpacity ?? 0.95,
        // The ramp itself. Leaflet writes these as attributes and the
        // transition on `.zone-path` does the interpolating — see
        // `zonePaint` in styles/statusTheme.ts for why it is a sequence.
        fillOpacity: isSelected
          ? paint.fillSelected
          : isHovered
            ? paint.fillHover
            : paint.fill,
        dashArray: paint.dashArray,
      }}
      eventHandlers={{
        click: () => {
          onSelectZone(zone.id)
          const layer = layerRef.current
          if (layer) pingRef.current(layer, zone.status)
        },
        mouseover: () => onHover(zone.id),
        mouseout: () => onLeave(zone.id),
      }}
    />
    </>
  )
}

/**
 * The public map: one Leaflet polygon per zone. MapPage owns the stable
 * details panel and report action, so zoom never clips a floating popup.
 *
 * THE BASE LAYER
 * --------------
 * This component is the map page's persistent base layer: it is mounted once,
 * behind all the floating chrome, and never unmounts. Leaflet measures its
 * container on mount and positions every pane with transforms, so the
 * container itself is never transformed (the old sheet's recede underlay is
 * gone with the sheet — the drawers clip inside their own windows instead).
 *
 * ZOOM CONTROL
 * ------------
 * `zoomControl={false}` and no `<ZoomControl>` child: Leaflet's control
 * renders 30px links and the app CSS hid it below 640px. Zoom now lives in
 * the top-right control column as 44px buttons on every viewport
 * (`MapControlColumn.tsx`), wired to this instance via `onMapReady`.
 *
 * ATTRIBUTION
 * -----------
 * `attributionControl={false}`: OSM attribution is a licence requirement and
 * must be visible in every state, so it is a persistent credit outside every
 * clip window — the always-visible pill pinned bottom-left in MapPage
 * (`map-attribution`), with the full credit also inside the zone drawer
 * (ZoneDrawer.tsx footer) as before.
 */
export function Map({
  zones,
  reports,
  selectedZoneId,
  resetToken,
  focusZoneId,
  focusToken,
  shippingLanesVisible = false,
  shippingOpacity = 1,
  focusReserveRight = 0,
  onMapReady,
  onSelectZone,
  onClearSelection,
  onTileStatus,
  tileRetry = 0,
}: MapProps) {
  const reduceMotion = useReducedMotion()
  const box = useMemo(
    () => zonesBoundingBox(zones.map((zone) => zone.polygon)),
    [zones],
  )
  const focusZone = useMemo(
    () => zones.find((zone) => zone.id === focusZoneId) ?? null,
    [zones, focusZoneId],
  )

  // Hover drives the polygon's fill up a step. On a phone this alone is not enough: Leaflet forwards only *mouse*
  // events to layers, so a tap delivers mouseover, mousedown and click in one
  // batch when the finger lifts (measured within 4ms of each other, ~113ms after
  // touchdown) and the ramp has no head start. `<ZonePressFeedback/>` covers
  // that window from the native `pointerdown`.
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null)
  // Stable slot the ping bridge writes into. Zone polygons call it on click;
  // until the bridge mounts (and under reduced motion) it is a no-op.
  const pingRef = useRef<ZonePing>(() => {})

  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_DEFAULT_ZOOM}
      maxBounds={MAP_MAX_BOUNDS}
      minZoom={8}
      maxZoom={18}
      maxBoundsViscosity={1}
      bounceAtZoomLimits={false}
      scrollWheelZoom
      // Zoom lives in the control column (see module doc); Leaflet's own
      // control is never rendered.
      zoomControl={false}
      attributionControl={false}
      // Leaflet retains the previous zoom's tiles until replacements load.
      // Do not add a competing opacity transition in CSS.
      fadeAnimation={!reduceMotion}
      zoomAnimation={!reduceMotion}
      markerZoomAnimation={!reduceMotion}
      inertia={!reduceMotion}
      className="h-full w-full"
    >
      <Basemap key={tileRetry} onStatus={onTileStatus} />
      <MapInteractions onClear={onClearSelection} />

      <MapMotionPolicy />
      <MapReadyBridge onMapReady={onMapReady} />
      <FitToBounds box={box} resetToken={resetToken} reserveRightPx={focusReserveRight} />
      <FocusZone zone={focusZone} token={focusToken} reserveRightPx={focusReserveRight} />
      <ZonePressFeedback />
      <ZoneHoverGlowBridge />
      <ZonePingBridge fireRef={pingRef} />
      <MapLoopGate />
      <ReportPins reports={reports} zones={zones} />
      <UserLocationDot />

      {/* Navigation-hazard lines sit UNDER the advisory polygons: secondary
          reference, never competing with the status colours. Fades via opacity prop. */}
      {shippingLanesVisible && <ShippingLayer opacity={shippingOpacity} />}

      {/* Zone boundary casings live one step below the overlay pane (400). */}
      <Pane name={ZONE_CASING_PANE} style={{ zIndex: 399 }} />

      {zones.map((zone, index) => (
        <ZonePolygon
          key={zone.id}
          zone={zone}
          isSelected={zone.id === selectedZoneId}
          // Everything except the current selection recedes while a
          // selection exists (element opacity 0.6 in `map-motion.css`).
          isDimmed={selectedZoneId !== null && zone.id !== selectedZoneId}
          isHovered={zone.id === hoveredZoneId}
          staggerIndex={index}
          onSelectZone={onSelectZone}
          onHover={setHoveredZoneId}
          onLeave={(zoneId) =>
            setHoveredZoneId((current) => (current === zoneId ? null : current))
          }
          pingRef={pingRef}
        />
      ))}
    </MapContainer>
  )
}

/** Background clicks clear selection; zone paths explicitly stop bubbling. */
function MapInteractions({ onClear }: { onClear?: () => void }) {
  const map = useMap()
  useEffect(() => {
    const clear = () => onClear?.()
    const container = map.getContainer()
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') clear() }
    map.on('click', clear)
    container.addEventListener('keydown', key)
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => map.invalidateSize({ pan: false, debounceMoveend: true })) : null
    observer?.observe(container)
    return () => { map.off('click', clear); container.removeEventListener('keydown', key); observer?.disconnect() }
  }, [map, onClear])
  return null
}

function Basemap({ onStatus }: { onStatus?: (status: 'loading' | 'ready' | 'error') => void }) {
  const failed = useRef(false)
  return <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} keepBuffer={3}
    updateWhenIdle updateWhenZooming={false}
    eventHandlers={{
      loading: () => { failed.current = false; onStatus?.('loading') },
      tileerror: () => { failed.current = true; onStatus?.('error') },
      load: () => onStatus?.(failed.current ? 'error' : 'ready'),
    }} />
}
