import { useId } from 'react'
import { useAppStore } from '../store'

/** Map-only preference; never persisted to or written into report records. */
export function ReviewedReportToggle({ checked, count, ready, onChange }: {
  checked: boolean; count: number; ready: boolean; onChange: (checked: boolean) => void
}) {
  const id = useId()
  const limited = useAppStore(state => state.reportsLimited)
  return <div className="map-options-preferences">
    <label className="map-options-review">
      <span className="map-options-review__copy">
        <span>Show report history</span>
        <small aria-hidden="true">Hidden &amp; reviewed reports</small>
      </span>
      <span aria-hidden="true" className="map-options-review__count">{ready ? count : '…'}</span>
      <input type="checkbox" checked={checked} disabled={!ready} aria-label="Show report history"
        onChange={event => onChange(event.target.checked)} aria-describedby={id}
        className="map-options-switch" />
    </label>
    <p id={id} className="sr-only">Shows reviewed reports and reports in green zones on this map. All records remain available in Reports, including any still awaiting review. This does not change report or zone status.</p>
    {limited && <p className="mt-2 text-xs text-muted">Markers use loaded recent and pending reports. Browse older records in Reports.</p>}
  </div>
}
