import { useCallback, useEffect } from 'react'
import { motion, useTransform } from 'motion/react'
import { MorphChevronIcon } from './MorphChevron'
import { isDragTail } from '../motion/sidePanelAnchors'
import { useClipWindowWidth, useSidePanel } from '../motion/useSidePanel'

/**
 * The community zone-count card as a collapsible side drawer.
 *
 * WHAT IT IS
 * ----------
 * The community zone-count card sits
 * in the top-right control column, between the zoom buttons and the zone
 * drawer's tab. On a phone it permanently covers that corner of the map, so
 * it tucks away into the RIGHT edge, leaving only a grab tab.
 *
 * The drawer moved from the left edge to the right edge in the pass that
 * replaced the bottom sheet with the zone drawer: the screenshot markup
 * pulled the collapsed grab tab to the top-right, and both drawer tabs now
 * live in one column — mirrored, the tab hugs the window's INNER (left) edge
 * and the card slides in and out of the right screen edge. What did NOT move
 * is the clip architecture below, which is the part that was verified and
 * must not regress. Its orientation is an input, not a rewrite: the same
 * hook, the same one-motion-value-drives-track-and-window invariant, the
 * same tap-after-drag guard.
 *
 * This is the drawer half of the split from the old merged `StatusPanel`,
 * which incorrectly swept the pills row into the swipeable panel and shipped
 * a rendering bug: content visibly bleeding outside the panel bounds during
 * partial-open states. The pills row now lives in `StatusKey.tsx` — fixed,
 * never in this subtree — and this drawer is built so that bug class cannot
 * recur:
 *
 * CLIP ARCHITECTURE (why content can never bleed)
 * -----------------------------------------------
 * The old panel translated the whole `[card + tab]` row rigidly and relied
 * on the *viewport edge* to clip it mid-drag, with translucent blurred cards
 * inside the translated subtree. `backdrop-filter` inside a transformed
 * ancestor is a known-bad combination on mobile GPUs: the blurred backdrop
 * layer can detach from its element mid-gesture while the text keeps
 * painting — floating disconnected text outside the visible card.
 *
 * This drawer clips structurally instead:
 *
 *   1. The card track slides inside a dedicated clip window
 *      (`overflow-hidden`) whose width is derived from the SAME motion value
 *      as the track's position. At `open` the window fits the whole card, at
 *      `collapsed` it is 0, and mid-drag it is exactly the visible
 *      remainder — the card is continuously clipped by the window at every
 *      drag position, and the viewport edge is never load-bearing.
 *   2. Nothing inside the translated track uses `backdrop-blur`. The gauge
 *      card is a solid `bg-ink-2`, so there is no backdrop layer to detach.
 *      (The grab tab keeps its blur: it is a static sibling, never inside a
 *      transformed ancestor.)
 *   3. The window width is clamped at both ends (`drawerWindowWidth`), so
 *      elastic overshoot past either anchor still clips cleanly.
 *
 * RIGHT-EDGE GEOMETRY — the mirror of the original left drawer
 * ------------------------------------------------------------
 * The row is [tab][window], right-aligned inside the control column, so the
 * window's right edge is pinned and its LEFT edge is the moving cut. The
 * track is `justify-end`-aligned inside the window (hugging the pinned
 * edge), and `offsets.collapsed` is `+cardWidth`: the track slides right,
 * into the edge, to tuck away. `drawerWindowWidth` mirrors to `width - x`,
 * the elastic ends swap, the chevron points the way the panel will move, and
 * ArrowRight collapses / ArrowLeft expands — every direction a user can
 * perceive flips, none of the maths does (see `sidePanelAnchors.ts`, where
 * the flick map is derived from the offsets themselves).
 *
 * States:
 *   open:      card fully visible (the resting position).
 *   collapsed: window at width 0; only the 44px grab tab shows. The collapsed
 *     drawer captures no pointer events, so pan/zoom/tap-zones work where the
 *     card used to sit.
 *
 * Animation:
 *   The same spring everywhere (stiffness 420, damping 34, mass 0.85), so
 *   this drawer and the zone drawer feel like one physics system. The card
 *   follows the finger 1:1 mid-drag; on release, velocity is projected
 *   forward (0.2s) and a flick always lands in the direction it was thrown.
 *   For reduced-motion the track jumps instantly (`offsetX.jump`), and the
 *   window follows through the same motion-value subscription.
 *
 * Drag surface (deliberately ONLY the tab):
 *   The gauge card stays `pointer-events-none` — it is a read-only instrument
 *   and map gestures pass through it. Giving it a drag surface would newly
 *   swallow map pans starting on that 172px card, which would be a regression
 *   for map interaction, not a feature.
 *
 * Non-drag path (accessibility is load-bearing, not optional):
 *   - the grab tab is a real `<button>`: tap / Enter / Space toggles;
 *   - ArrowRight collapses and ArrowLeft expands when the tab is focused —
 *     the directional pair for a RIGHT-edge drawer, so keyboard users get
 *     the same directional control as swipe users;
 *   - `aria-expanded` + `aria-controls` expose the state to assistive tech.
 *   - on desktop/non-touch there is no separate path to learn: the same tab
 *     is a click toggle and a mouse-drag handle. No swipe simulation.
 */

export interface AdvisoryDrawerProps {
  advisory: number
  zones: number
  pending: number
  unavailable?: number
  ready?: boolean
  reportsReady?: boolean
}

const TAB_LABEL: Record<'open' | 'collapsed', string> = {
  open: 'Collapse zone counts panel',
  collapsed: 'Expand zone counts panel',
}

export function AdvisoryDrawer({ advisory, zones, pending, unavailable = 0, ready = true, reportsReady = true }: AdvisoryDrawerProps) {
  const panel = useSidePanel(typeof window !== 'undefined' && window.innerHeight <= 480 ? 'collapsed' : 'open', { edge: 'right' })
  useEffect(() => {
    const compact = () => { if (window.innerHeight <= 480) panel.goTo('collapsed') }
    window.addEventListener('resize', compact)
    return () => window.removeEventListener('resize', compact)
  }, [panel.goTo])
  const open = panel.state === 'open'
  const tabLabel = TAB_LABEL[panel.state]

  // The clip window's width, driven by the same motion value as the track's
  // position (shared hook — see `useClipWindowWidth` in useSidePanel.ts).
  const windowWidth = useClipWindowWidth(panel.offsetX, panel.panelWidth, panel.edge)

  // The tab-to-window gap, derived from the same clip-window motion value: 0
  // when collapsed — so the tab sits flush with the column's right edge,
  // exactly like the zoom buttons — ramping to the full 6px as soon as the
  // window cracks open. A static `gap` on the row would persist while the
  // window is 0px wide and leave the collapsed tab 6px off the edge. This is
  // a margin, not a transform, so the tab keeps its backdrop blur on a
  // never-transformed layer (see the clip architecture notes above).
  const tabGap = useTransform(windowWidth, [0, 8], [0, 6], { clamp: true })

  const handleTabClick = useCallback(
    (event: React.MouseEvent) => {
      if (isDragTail(panel.didDrag(), event.detail)) return
      panel.toggle()
    },
    [panel],
  )

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Enter/Space already toggle via the native button click; arrows give
      // keyboard users the same directional control swipe users have. This
      // is a RIGHT-edge drawer: Right tucks into the edge, Left opens out of
      // it.
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        panel.goTo('collapsed')
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        panel.goTo('open')
      }
    },
    [panel],
  )

  return (
    <div
      className="zone-count-drawer pointer-events-none flex items-stretch justify-end"
      role="region"
      aria-label="Community zone counts"
      data-testid="advisory-drawer"
      data-state={panel.state}
      data-dragging={panel.dragging || undefined}
    >
      {/* --- Grab tab ------------------------------------------------------
          The vertical analogue of the sheet's handle: same pill-grabber
          language, rotated 90°. A static sibling of the window — it hugs
          the window's INNER edge as the window shrinks, and it is the 44px
          that stays on screen when collapsed (touch hit-area floor). The
          drawer's only drag surface, `touch-action: none`. */}
      <motion.button
        type="button"
        onPointerDown={panel.startDrag}
        onClick={handleTabClick}
        onKeyDown={handleTabKeyDown}
        aria-expanded={open}
        aria-controls="advisory-drawer-body"
        aria-label={tabLabel}
        title={tabLabel}
        data-testid="advisory-drawer-tab"
        style={{ marginRight: tabGap }}
        className="zone-count-tab pointer-events-auto flex w-11 shrink-0 select-none flex-col items-center justify-center gap-2 self-start rounded-lg border border-line bg-ink-2/88 py-3 backdrop-blur-md transition-colors [touch-action:none] hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* Geometry morph, not a rotation: the arms fold through a vertical
            stroke between ‹ and › (see MorphChevron). */}
        <MorphChevronIcon open={open} className="h-3.5 w-3.5 text-paper/70" />
        <span
          aria-hidden="true"
          className="drawer-grip block h-8 w-1 rounded-full bg-line-soft"
        />
      </motion.button>

      {/* --- Clip window ---------------------------------------------------
          `overflow-hidden` is load-bearing: this is what clips the card
          mid-drag. Its width tracks the track position 1:1 (see above), so
          the visible card edge is always a clean cut — never floating
          text. `shrink-0` keeps flexbox from squeezing the window below the
          width the motion value sets; `flex justify-end` pins the track to
          the window's RIGHT (anchored) edge, so the LEFT edge is the cut
          that moves with the window's width. */}
      <motion.div
        style={{ width: windowWidth }}
        className="flex shrink-0 justify-end overflow-hidden"
        data-testid="advisory-drawer-window"
      >
        {/* --- Card track --------------------------------------------------
            The only translated element in the drawer. `w-max` is
            load-bearing: a block child would shrink to the window's width
            and corrupt the width measurement (and re-pin the drawer
            mid-drag); `max-content` keeps the track at the card's own
            width whatever the window is doing. */}
        <motion.div
          ref={panel.panelRef}
          id="advisory-drawer-body"
          inert={!open}
          style={{ x: panel.offsetX }}
          drag="x"
          dragListener={false}
          dragControls={panel.dragControls}
          dragConstraints={panel.constraints}
          // Asymmetric elasticity: pulling left past open barely gives
          // (open is home), pulling right past collapsed gives a little —
          // the card straining at the window edge.
          dragElastic={{ left: 0.02, right: 0.05 }}
          dragMomentum={false}
          onDragStart={panel.onDragStart}
          onDragEnd={(_event, info) => panel.onDragEnd(info)}
          className="w-max"
        >
          <AdvisoryGauge advisory={advisory} zones={zones} pending={pending} unavailable={unavailable} ready={ready} reportsReady={reportsReady} />
        </motion.div>
      </motion.div>
    </div>
  )
}

/** Exact record counts, without implying a tide forecast or probability. */
function AdvisoryGauge({ advisory, zones, pending, unavailable, ready, reportsReady }: Required<AdvisoryDrawerProps>) {
  return (
    <div className="pointer-events-none w-[172px] rounded-lg border border-line bg-ink-2 p-2.5" data-testid="advisory-gauge">
      <p className="text-xs font-medium text-paper">Community warnings</p>
      <p className="mt-1 text-sm tabular-nums text-paper">{ready ? zones > 0 ? `${advisory} of ${zones} zones flagged` : 'No zone records' : 'Loading zone records'}</p>
      <p className="mt-1 text-xs tabular-nums text-muted">{ready ? `${unavailable} status unavailable` : 'Status not received'}</p>
      <p className="mt-1 text-xs tabular-nums text-muted">{reportsReady ? `${pending} pending reports` : 'Reports loading'}</p>
    </div>
  )
}
