import { ZONE_STATUS_ORDER } from '../lib/status'
import { zoneLabel, zoneTheme } from '../styles/statusTheme'
import type { ZoneStatus } from '../types'
import { DataProvenance } from './DataProvenance'
import { ZoneStatusIcon } from './ZoneStatusIcon'

/** Secondary detail lives after zone selection; source and clearance stay above it. */
export function ZoneConnectionDetails({ counts, ready }: { counts: Record<ZoneStatus, number>; ready: boolean }) {
  return <details className="mt-5 rounded-lg border border-line bg-ink p-3">
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-paper focus-visible:outline-2 focus-visible:outline-accent"><span aria-hidden="true">＋</span>Status counts and connection</summary>
    <dl className="my-3 grid grid-cols-2 gap-2">
      {ZONE_STATUS_ORDER.map(status => <div key={status} className="flex items-center justify-between gap-2 rounded-md border border-line p-2.5">
        <dt className="flex items-center gap-2 text-xs text-muted"><span style={{ color: zoneTheme(status).hex }}><ZoneStatusIcon status={status} /></span>{zoneLabel(status)}</dt>
        <dd className="font-mono text-sm" style={{ color: zoneTheme(status).hex }}>{ready ? counts[status] : '—'}</dd>
      </div>)}
    </dl>
    <DataProvenance />
  </details>
}
