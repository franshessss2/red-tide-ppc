import { useId } from 'react'

/** Map-only preference; never persisted to or written into report records. */
export function ReviewedReportToggle({ checked, count, ready, onChange }: {
  checked: boolean; count: number; ready: boolean; onChange: (checked: boolean) => void
}) {
  const id = useId()
  return <div className="pointer-events-auto max-w-[calc(100vw-24px)] rounded-lg border border-line bg-ink-2/95 px-3 shadow-lg">
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-xs text-paper">
      <input type="checkbox" checked={checked} disabled={!ready}
        onChange={event => onChange(event.target.checked)} aria-describedby={id}
        className="h-4 w-4 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
      <span>Show reviewed reports</span>
      <span aria-hidden="true" className="rounded bg-paper/5 px-1.5 py-0.5 font-mono text-[10px] text-muted">{ready ? count : '…'}</span>
    </label>
    <p id={id} className="sr-only">Only changes report markers on this map. All records remain available in Reports. Reviewing a report does not establish that a zone is safe.</p>
  </div>
}
