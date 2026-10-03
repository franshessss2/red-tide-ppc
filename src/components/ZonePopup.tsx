import { ZoneStatusIcon } from './ZoneStatusIcon'
import { CommunitySource } from './DataProvenance'
import { formatRecordTime } from '../lib/format'
import { zoneGuidance, zoneLabel, zoneTheme } from '../styles/statusTheme'
import type { Zone } from '../types'

/**
 * Content of the Leaflet popup shown when a zone polygon is tapped.
 *
 * MOTION
 * ------
 * The entrance is pure CSS, not `motion`. Leaflet detaches the popup node from
 * the DOM on close and re-attaches it on open, and re-attaching restarts CSS
 * animations — so `.zone-popup-line` replays its rise-in on every open and on
 * every switch between zones, with no JS at all.
 *
 * A JS exit animation is deliberately NOT attempted: Leaflet removes the popup
 * element synchronously inside its own `onRemove`, so there is no frame in
 * which to animate out. Intercepting that would mean monkey-patching Leaflet,
 * which is not worth the risk to the zone-click → popup → report-form flow.
 *
 * TYPOGRAPHY
 * ----------
 * Zone name in Bebas Neue, everything technical (status, counts, timestamps) in
 * JetBrains Mono, prose in Space Grotesk. Timestamps are the one thing users
 * compare across zones, so they are monospaced to keep digits column-aligned.
 */
export function ZonePopup({
  zone,
  pendingCount,
  onReport,
}: {
  zone: Zone
  pendingCount: number
  onReport: () => void
}) {
  const theme = zoneTheme(zone.status)

  return (
    <div className="p-4">
      <div className="flex items-center gap-2" style={{ ['--i' as string]: 0 }}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${theme.pillClass}`}
        >
          <ZoneStatusIcon status={zone.status} />
          {zoneLabel(zone.status)}
        </span>
      </div>

      {/* Bebas Neue: condensed enough that the longest zone name
          ("Sabang — St. Paul Bay (North Coast)") still fits two lines at 320px. */}
      <h3
        className="zone-popup-line font-display mt-2 pr-4 text-[22px] leading-[0.95] text-paper"
        style={{ ['--i' as string]: 1 }}
      >
        {zone.name}
      </h3>

      <p
        className="mt-2 text-xs leading-relaxed text-muted"
        style={{ ['--i' as string]: 2 }}
      >
        {zoneGuidance(zone.status)}
      </p>

      {pendingCount > 0 && (
        <p
          className="zone-popup-line mt-2.5 flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/10 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent"
          style={{ ['--i' as string]: 3 }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          {pendingCount} {pendingCount === 1 ? 'report' : 'reports'} waiting review
        </p>
      )}

      <dl
        className="zone-popup-line mt-3 border-t border-line pt-2.5"
        style={{ ['--i' as string]: pendingCount > 0 ? 4 : 3 }}
      >
        <dt className="text-xs text-muted">Status changed</dt>
        <dd className="mt-1 text-xs text-paper">{formatRecordTime(zone.lastUpdated, zone.lastUpdatedPending)}</dd>
      </dl>

      <div className="mt-3"><CommunitySource /></div>

      <button
        type="button"
        onClick={onReport}
        style={{ ['--i' as string]: pendingCount > 0 ? 5 : 4 }}
        className="motion-press zone-popup-line mt-3 w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-ink transition-transform duration-[var(--motion-fast)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Report something here
      </button>
    </div>
  )
}
