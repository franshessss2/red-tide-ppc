import type { useReportArchive } from '../lib/useReportArchive'

export function ReportArchiveControls({ archive }: { archive: ReturnType<typeof useReportArchive> }) {
  return <div className="my-3 rounded-lg border border-line p-3 text-xs text-muted">
    {archive.limited && <p>Live view: recent dated reports and all pending reports. Pending counts remain complete. Archive search and counts cover loaded pages. Older pages are snapshots; refresh to check them again.</p>}
    <label className="mt-2 flex flex-wrap items-center gap-2">Archive order
      <select aria-label="Report archive order" value={archive.allRecords ? 'all' : 'dated'} onChange={event => archive.setAllRecords(event.target.value === 'all')} className="max-w-full rounded-lg border border-line bg-ink p-2 text-paper">
        <option value="dated">Newest dated reports</option><option value="all">All records by ID · includes undated</option>
      </select>
    </label>
    {archive.allRecords && <p className="mt-2">Browse all records by ID in small pages, including older records without a submission date. The loaded records below are displayed by known date.</p>}
    <div className="mt-2 flex flex-wrap gap-3">
      {archive.hasMore && <button type="button" disabled={archive.loading} onClick={() => void archive.load()} className="min-h-11 text-accent underline disabled:opacity-40">{archive.loading ? 'Loading archive…' : 'Load next archive page'}</button>}
      <button type="button" onClick={archive.refresh} className="min-h-11 underline">Refresh archive</button>
    </div>
    {archive.error && <p role="alert">{archive.error} <button type="button" onClick={() => void archive.load()} className="text-accent underline">Retry archive</button></p>}
  </div>
}
