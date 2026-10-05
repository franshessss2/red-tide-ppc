import { useEffect, useId, useRef, useState } from 'react'
import { ZONE_STATUS_ORDER } from '../lib/status'
import { zoneLabel, zoneTheme } from '../styles/statusTheme'
import type { Zone, ZoneStatus } from '../types'
import { AdvisoryBanner, Primer, ZoneCardItem } from './ZoneDrawer'
import { useAppStore } from '../store'
import { feedLabel } from '../lib/feed'
import { DataProvenance } from './DataProvenance'
import { ZoneListSkeleton } from './LoadingState'
import { ZoneStatusIcon } from './ZoneStatusIcon'

export type MobilePanelState = 'peek' | 'mid' | 'full'
interface Props {
  state: MobilePanelState
  onStateChange: (state: MobilePanelState) => void
  zones: Zone[]
  zonesReady: boolean
  reportsReady: boolean
  counts: Record<ZoneStatus, number>
  pendingCounts: Record<string, number>
  pending: number
  selectedZoneId: string | null
  onFocusZone: (id: string) => void
  onReport: (id: string) => void
}

/** Mobile information has one owner; map gestures never drag this sheet. */
export function MobileMapPanel(props: Props) {
  const { state, onStateChange, zones, zonesReady, reportsReady, counts } =
    props
  const feed = useAppStore((store) => store.zonesFeed)
  const reportsFeed = useAppStore((store) => store.reportsFeed)
  const id = useId()
  const open = state !== 'peek'
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollRoot, setScrollRoot] = useState<Element | null>(null)
  const openTimestampRef = useRef(0)
  useEffect(() => {
    if (open) {
      openTimestampRef.current = Date.now()
      setScrollRoot(scrollRef.current)
    }
  }, [open])
  const summary = !zonesReady
    ? 'Zone records loading'
    : `${zones.length} zones · ${counts.advisory} flagged`
  return (
    <section
      className="mobile-map-panel"
      data-state={state}
      aria-label="Coastal records"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          onStateChange('peek')
          document.getElementById(`${id}-toggle`)?.focus()
        }
      }}
    >
      <button
        id={`${id}-toggle`}
        type="button"
        className="mobile-map-panel__toggle"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => onStateChange(open ? 'peek' : 'mid')}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            onStateChange('full')
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            onStateChange('peek')
          }
        }}
      >
        <span className="mobile-map-panel__grip" aria-hidden="true" />
        <span className="flex w-full items-center justify-between gap-2">
          <span>{summary}</span>
          <span aria-hidden="true">{open ? '⌄' : '⌃'}</span>
        </span>
        <span className="text-xs font-normal text-muted">
          {reportsFeed.phase === 'error'
            ? 'Report connection unavailable · View details'
            : `${feedLabel(feed)} · View details`}
        </span>
      </button>
      {open && (
        <div
          id={`${id}-body`}
          ref={scrollRef}
          className="mobile-map-panel__body"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-xl">Zone status</h2>
            <button
              type="button"
              className="min-h-11 rounded-md border border-line px-3 text-xs text-paper"
              onClick={() => onStateChange(state === 'full' ? 'mid' : 'full')}
            >
              {state === 'full' ? 'Smaller panel' : 'Expand panel'}
            </button>
          </div>
          <dl className="mobile-map-status-grid">
            {ZONE_STATUS_ORDER.map((status) => (
              <div
                key={status}
                className="flex items-center justify-between gap-2 rounded-md border border-line p-2.5"
              >
                <dt className="flex items-center gap-2 text-xs">
                  <span style={{ color: zoneTheme(status).hex }}>
                    <ZoneStatusIcon status={status} />
                  </span>
                  {zoneLabel(status)}
                </dt>
                <dd
                  className="font-mono text-sm"
                  style={{ color: zoneTheme(status).hex }}
                >
                  {zonesReady ? counts[status] : '—'}
                </dd>
              </div>
            ))}
          </dl>
          <p className="my-3 text-xs text-muted">
            {reportsReady
              ? `${props.pending} pending reports`
              : 'Report records loading'}
          </p>
          <AdvisoryBanner
            counts={counts}
            total={zones.length}
            ready={zonesReady}
          />
          <div className="mt-3">
            <DataProvenance />
          </div>
          <h2 className="mb-3 mt-5 font-display text-xl">Coastal zones</h2>
          {!zonesReady ? (
            <ZoneListSkeleton />
          ) : (
            <ul className="grid gap-3">
              {zones.map((zone, index) => (
                <ZoneCardItem
                  key={zone.id}
                  zone={zone}
                  index={index}
                  scrollRoot={scrollRoot}
                  open={open}
                  pending={props.pendingCounts[zone.id] ?? 0}
                  isSelected={zone.id === props.selectedZoneId}
                  onFocusZone={props.onFocusZone}
                  onReport={props.onReport}
                  openTimestampRef={openTimestampRef}
                />
              ))}
            </ul>
          )}
          {zonesReady && zones.length === 0 && (
            <p className="text-sm text-muted">
              No coastal records available. Check official BFAR bulletins.
            </p>
          )}
          <Primer scrollRoot={scrollRoot} open={open} />
        </div>
      )}
    </section>
  )
}
