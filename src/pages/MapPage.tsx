import { StreetMapDialog } from '../components/StreetMapDialog'
import { reportSuccessMessage } from '../lib/reportFeedback'
import { MapFeedStatus } from '../components/DataProvenance'
import { LiveDataStatus } from '../components/LiveDataStatus'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Map as LeafletMap } from 'leaflet'
import { AnimatePresence, motion } from 'motion/react'
import { RegistrationMarks, Scanline } from '../components/Ambient'
import { AdvisoryDrawer } from '../components/AdvisoryDrawer'
import {
  MobileMapPanel,
  type MobilePanelState,
} from '../components/MobileMapPanel'
import { MobileMapActions } from '../components/MobileMapActions'
import '../styles/mobile-map.css'
import { Header } from '../components/Header'
import { StatusKey } from '../components/StatusKey'
import { MapLoadingOverlay } from '../components/LoadingState'
import { Map } from '../components/Map'
import { MapControlColumn } from '../components/MapControlColumn'
import { Notice } from '../components/Notice'
import { ReportForm } from '../components/ReportForm'
import { ZONE_PANEL_FALLBACK_WIDTH, ZoneDrawer } from '../components/ZoneDrawer'
import { useSidePanel } from '../motion/useSidePanel'
import type { SidePanelState } from '../motion/sidePanelAnchors'
import {
  DRAWER_RESERVE_COLLAPSED,
  DRAWER_RESERVE_OPEN,
} from '../motion/mapMotion'
import { resolveActiveStatus } from '../motion/statusKey'
import { useReducedMotion } from '../motion/preferences'
import { usePresenceProgress } from '../motion/usePresenceProgress'
import { MOTION, spring, tween } from '../motion/tokens'

import { selectPendingCountByZone, selectZoneById, useAppStore } from '../store'
import type { Zone, ZoneStatus } from '../types'

/** The map stays mounted and full size. Desktop uses the original side drawers;
 * mobile groups status, zones and source details in a single bottom panel.
 * Zoom, attribution and the compact header remain outside the panel. */

/** Below 768 the drawer starts tucked (map is the hero); at ≥768 it starts open. */
function initialZoneDrawerState(): SidePanelState {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    return window.matchMedia('(min-width: 768px)').matches
      ? 'open'
      : 'collapsed'
  }
  return 'collapsed'
}

/** True when the viewport is currently below the 768px drawer breakpoint. */
function isBelowDrawerBreakpoint(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(min-width: 768px)').matches
  )
}

export function MapPage() {
  const zones = useAppStore((state) => state.zones)
  const reports = useAppStore((state) => state.reports)
  const zonesFeed = useAppStore((state) => state.zonesFeed)
  const reportsReady = useAppStore((state) => state.reportsReady)
  const zonesReady = useAppStore((state) => state.zonesReady)
  const selectedZoneId = useAppStore((state) => state.selectedZoneId)
  const reportZoneId = useAppStore((state) => state.reportZoneId)
  const selectZone = useAppStore((state) => state.selectZone)
  const openReportForm = useAppStore((state) => state.openReportForm)
  const closeReportForm = useAppStore((state) => state.closeReportForm)
  const reduceMotion = useReducedMotion()

  const [streetMapOpen, setStreetMapOpen] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<MobilePanelState>('peek')
  const [resetToken, setResetToken] = useState(0)
  const [focusToken, setFocusToken] = useState(0)
  // The Leaflet instance, published by the map once mounted so the control
  // column's zoom buttons can drive it.
  const [leafletMap, setLeafletMap] = useState<LeafletMap | null>(null)
  // Shipping-channel overlay (PCG PPTSS lines): OFF by default — a secondary
  // safety reference that must not compete with the advisory zones. Local UI
  // state on purpose: not app data, nothing to persist or sync.
  const [shippingLanesVisible, setShippingLanesVisible] = useState(false)
  const { mounted: shippingMounted, progress: shippingOpacity } =
    usePresenceProgress(shippingLanesVisible)

  // One-time discoverability hint for the overlay toggle: the ship glyph is
  // icon-only, and "PCG shipping lane" is not guessable from an icon. Shown
  // once (localStorage-gated), auto-dismisses, and toggling the layer
  // dismisses it too.
  const [shippingHintOpen, setShippingHintOpen] = useState(() => {
    try {
      return (
        localStorage.getItem('red-tide-ppc:hint:shipping:v1') !== 'dismissed'
      )
    } catch {
      return false // no storage — stay quiet rather than nag every load
    }
  })
  useEffect(() => {
    if (!shippingHintOpen) return
    const timer = window.setTimeout(
      () => dismissShippingHint(),
      MOTION.time.noticeHold * 1000,
    )
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingHintOpen])

  function dismissShippingHint() {
    setShippingHintOpen(false)
    try {
      localStorage.setItem('red-tide-ppc:hint:shipping:v1', 'dismissed')
    } catch {
      // private mode / storage disabled — dismissal just won't persist
    }
  }

  function toggleShippingLanes() {
    setShippingLanesVisible((visible) => !visible)
    if (shippingHintOpen) dismissShippingHint()
  }

  // One controller for the zone drawer, lifted here so zone focus can tuck
  // it: the same hook the advisory drawer uses internally, right-edge.
  const zonePanel = useSidePanel(initialZoneDrawerState(), {
    edge: 'right',
    fallbackWidth: ZONE_PANEL_FALLBACK_WIDTH,
  })

  // The right-edge reservation the focus flight keeps clear: the open drawer
  // panel on desktop. On phones the drawer tucks itself the moment a zone is
  // focused (see `focusZone` below), and below the breakpoint the flight
  // ignores this value anyway — so it is only ever the desktop constants.
  const focusReserveRight =
    zonePanel.state === 'open' ? DRAWER_RESERVE_OPEN : DRAWER_RESERVE_COLLAPSED

  const pendingCounts = useMemo(
    () => selectPendingCountByZone(reports),
    [reports],
  )

  const pendingTotal = useMemo(
    () =>
      Object.values(pendingCounts).reduce((total, count) => total + count, 0),
    [pendingCounts],
  )

  const statusCounts = useMemo(() => {
    const counts: Record<ZoneStatus, number> = {
      safe: 0,
      unconfirmed: 0,
      advisory: 0,
      unknown: 0,
    }
    for (const zone of zones) counts[zone.status] += 1
    return counts
  }, [zones])

  // The fixed pills row lights the selected zone's status; with no selection
  // it rests on the worst status that actually has zones (see statusKey.ts).
  const activeStatus = resolveActiveStatus(
    selectZoneById(zones, selectedZoneId)?.status ?? null,
    statusCounts,
  )

  const reportZone = selectZoneById(zones, reportZoneId)

  const [heldZone, setHeldZone] = useState<Zone | null>(null)
  useEffect(() => {
    if (reportZone) setHeldZone(reportZone)
  }, [reportZone])

  function focusZone(zoneId: string) {
    selectZone(zoneId)
    setFocusToken((token) => token + 1)
    // Below the breakpoint the drawer covers most of the map, so tuck it and
    // let the fly-to read; at ≥768 the panel leaves the map fully visible.
    setMobilePanel('peek')
    if (isBelowDrawerBreakpoint() && zonePanel.state !== 'collapsed') {
      zonePanel.goTo('collapsed')
    }
  }

  const headerActions = (
    <>
      <button type="button" aria-label="Open street map" title="Street map"
        onClick={() => { setMobilePanel('peek'); dismissShippingHint(); setStreetMapOpen(true) }}
        className="grid h-8 w-8 place-items-center rounded-md border border-line bg-ink-2/85 text-paper/75 hover:text-accent">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z M9 3v16 M15 5v16" /></svg>
      </button>
      <span className="relative inline-flex">
        <button
          type="button"
          onClick={toggleShippingLanes}
          aria-pressed={shippingLanesVisible}
          aria-label="Shipping channel overlay — show or hide the port traffic lanes"
          title="Shipping channel overlay (PCG TSS) — where boats meet ship traffic"
          className={`grid h-8 min-w-8 place-items-center rounded-md border px-1.5 backdrop-blur-md transition-colors ${
            shippingLanesVisible
              ? 'border-[#2e7cd6] bg-[#2e7cd6]/15 text-[#9cc4f7]'
              : 'border-line bg-ink-2/85 text-paper/75 hover:border-accent/40 hover:text-accent'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* ship: hull + cargo + waterline */}
            <path d="M3 17c1.5 1.6 3 1.6 4.5 0s3-1.6 4.5 0 3 1.6 4.5 0 3-1.6 4.5 0" />
            <path d="M5 13.5 6 8h12l1 5.5" />
            <path d="M12 8V5m-3 3V6h6v2" />
          </svg>
        </button>
        <AnimatePresence>
          {shippingHintOpen && (
            <motion.span
              key="shipping-hint"
              initial={{ scale: reduceMotion ? 1 : 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: reduceMotion ? 0 : -4,
                transition: {
                  duration: reduceMotion ? 0 : MOTION.time.hintExit,
                  ease: MOTION.ease.in,
                },
              }}
              transition={spring(reduceMotion)}
              style={{ transformOrigin: 'top right' }}
              role="status"
              className="hidden md:block absolute right-0 top-[calc(100%+10px)] z-[var(--layer-controls)] w-max max-w-[240px] rounded-lg border border-line bg-ink-2 px-3 py-2 text-left shadow-lg"
            >
              <span className="block font-display text-[11px] font-semibold leading-snug tracking-[0.02em] text-[#9cc4f7]">
                New: shipping lane lines
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-paper/75">
                Where ships transit the port approach — worth knowing before you
                drift.
              </span>
              <button
                type="button"
                onClick={dismissShippingHint}
                className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-paper/60 underline-offset-2 hover:text-paper"
              >
                Got it
              </button>
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <button
        type="button"
        onClick={() => setResetToken((token) => token + 1)}
        aria-label="Reset view"
        title="Reset view"
        className="grid h-8 w-8 place-items-center rounded-md border border-line bg-ink-2/85 text-paper/75 backdrop-blur-md transition-colors hover:border-accent/40 hover:text-accent"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="7" />
          <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
      <Link
        to="/admin"
        className="rounded-md border border-line bg-ink-2/85 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-paper/75 backdrop-blur-md transition-colors hover:border-accent/40 hover:text-accent"
      >
        Admin
      </Link>
    </>
  )

  return (
    <div
      data-mobile-panel={mobilePanel}
      className="map-page relative h-[100dvh] overflow-hidden bg-ink"
    >
      <LiveDataStatus />
      {/* ------------------------------------------------------------------
          Layer 1: the map — static, full-bleed, never transformed.
          ------------------------------------------------------------------ */}
      <div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-ink">
        <Map
          zones={zones}
          pendingCounts={pendingCounts}
          selectedZoneId={selectedZoneId}
          resetToken={resetToken}
          focusZoneId={selectedZoneId}
          focusToken={focusToken}
          shippingLanesVisible={shippingMounted}
          shippingOpacity={shippingOpacity}
          reports={reports}
          focusReserveRight={focusReserveRight}
          onMapReady={setLeafletMap}
          onSelectZone={(id) => {
            selectZone(id)
            setMobilePanel('peek')
          }}
          onEmptyClick={() => {
            if (isBelowDrawerBreakpoint()) {
              selectZone(null)
              setMobilePanel('peek')
            }
          }}
          onReport={openReportForm}
        />

        <Scanline />
        <RegistrationMarks />
      </div>

      {/* ------------------------------------------------------------------
          Layer 2: floating chrome — header, fixed pills, control column.
          Always visible: there is no sheet progress to fade with anymore.
          ------------------------------------------------------------------ */}
      <Header
        overlay
        eyebrow="Puerto Princesa, Palawan"
        title="Red Tide"
        right={
          <>
            <div className="hidden items-center gap-1.5 md:flex">
              {headerActions}
            </div>
            <MobileMapActions
              onOpen={() => setMobilePanel('peek')}
              panelOpen={mobilePanel !== 'peek'}
            >
              {headerActions}
            </MobileMapActions>
          </>
        }
      />

      {/* Two kinds of chrome, two contracts: the pills row is fixed and never
          moves; the drawers tuck into the right edge behind their tabs. */}
      <div className="hidden md:block">
        <StatusKey
          counts={statusCounts}
          activeStatus={activeStatus}
          ready={zonesReady}
        />
      </div>

      {zonePanel.state === 'collapsed' && (
        <div className="hidden md:block absolute bottom-[max(3.25rem,calc(env(safe-area-inset-bottom)+2.5rem))] left-3 z-[var(--layer-controls)] max-w-[calc(100vw-5rem)] sm:max-w-sm">
          <MapFeedStatus />
        </div>
      )}

      <MapControlColumn map={leafletMap}>
        <AdvisoryDrawer
          advisory={statusCounts.advisory}
          zones={zones.length}
          pending={pendingTotal}
          unavailable={statusCounts.unknown}
          ready={zonesReady}
          reportsReady={reportsReady}
        />
        <ZoneDrawer
          zones={zones}
          zonesReady={zonesReady}
          pendingCounts={pendingCounts}
          counts={statusCounts}
          selectedZoneId={selectedZoneId}
          panel={zonePanel}
          onFocusZone={focusZone}
          onReport={openReportForm}
        />
      </MapControlColumn>

      <MobileMapPanel
        state={mobilePanel}
        onStateChange={setMobilePanel}
        zones={zones}
        zonesReady={zonesReady}
        reportsReady={reportsReady}
        pendingCounts={pendingCounts}
        counts={statusCounts}
        pending={pendingTotal}
        selectedZoneId={selectedZoneId}
        onFocusZone={focusZone}
        onReport={(id) => {
          setMobilePanel('peek')
          openReportForm(id)
        }}
      />

      {/* Layer 3: the licence credit — always visible in every drawer state,
          outside every clip window (bottom-LEFT: the toasts own bottom-right,
          so this corner can never be permanently covered). */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        data-testid="map-attribution"
        className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-[var(--layer-controls)] rounded-md border border-line/70 bg-ink/78 px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-faint backdrop-blur-sm transition-colors hover:text-accent"
      >
        © OpenStreetMap contributors
      </a>

      <AnimatePresence initial={false}>
        {!zonesReady && zonesFeed.phase !== 'error' && (
          <motion.div
            key="map-loading-overlay"
            className="absolute inset-0 z-[var(--layer-loading)]"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tween(reduceMotion, MOTION.time.exit)}
          >
            <MapLoadingOverlay />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------
          Layer 4: modals.
          ------------------------------------------------------------------ */}
      {streetMapOpen && <StreetMapDialog onClose={() => setStreetMapOpen(false)} />}
      {heldZone && (
        <ReportForm
          key={heldZone.id}
          zone={heldZone}
          open={Boolean(reportZone)}
          onClose={closeReportForm}
          onDismissed={() => {
            if (useAppStore.getState().reportZoneId === null) setHeldZone(null)
          }}
        />
      )}

      <Notice
        suppressNotice={
          heldZone ? reportSuccessMessage(heldZone.name) : undefined
        }
      />
    </div>
  )
}
