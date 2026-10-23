import { useId } from 'react'

/** Map-only preference; never persisted to or written into report records. */
export function ReviewedReportToggle({ checked, count, ready, onChange }: {
  checked: boolean; count: number; ready: boolean; onChange: (checked: boolean) => void
}) {
  const id = useId()
  return <div className="map-options-preferences">
    <label className="map-options-review">
      <span className="map-options-review__copy">
        <span>Show reviewed reports</span>
        <small aria-hidden="true">Include completed reviews</small>
      </span>
      <span aria-hidden="true" className="map-options-review__count">{ready ? count : '…'}</span>
      <input type="checkbox" checked={checked} disabled={!ready} aria-label="Show reviewed reports"
        onChange={event => onChange(event.target.checked)} aria-describedby={id}
        className="map-options-switch" />
    </label>
    <p id={id} className="sr-only">Only changes report markers on this map. All records remain available in Reports. Reviewing a report does not establish that a zone is safe.</p>
  </div>
}
