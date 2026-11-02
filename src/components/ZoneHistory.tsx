import { useEffect, useRef, useState } from 'react'
import { getBackend } from '../lib/backend'
import { formatRecordTime } from '../lib/format'
import { zoneStatusMeta } from '../lib/status'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { useAppStore } from '../store'
import type { ZoneChange } from '../types'

/** Public append-only records; failed or missing feeds never imply empty history. */
export function ZoneHistory() {
  const zones = useAppStore(state => state.zones)
  const kind = useAppStore(state => state.backendKind)
  const online = useOnlineStatus()
  const [changes, setChanges] = useState<ZoneChange[]>([])
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'unsupported'>('loading')
  const [cached, setCached] = useState(false)
  const [pending, setPending] = useState(false)
  const [retry, setRetry] = useState(0)
  const [zoneId, setZoneId] = useState('')
  const [limit, setLimit] = useState(30)
  const [older, setOlder] = useState<ZoneChange[]>([])
  const [more, setMore] = useState(false)
  const [loadingPage, setLoadingPage] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const pageCursor = useRef<unknown>(undefined)
  const paging = useRef(false)
  const started = useRef(false)
  const generation = useRef(0)
  useEffect(() => {
    let active = true
    generation.current++; started.current = false; paging.current = false; pageCursor.current = undefined
    setOlder([]); setMore(false); setLoadingPage(false); setPageError(null); setLimit(30)
    setChanges([]); setPhase('loading')
    const backend = getBackend()
    if (!backend.subscribeToZoneChanges) { setPhase('unsupported'); return }
    let stop: (() => void) | undefined
    try {
      stop = backend.subscribeToZoneChanges((next, metadata) => {
        if (!active) return
        setChanges([...next].sort((a, b) => (b.changedAt ?? 0) - (a.changedAt ?? 0) || b.id.localeCompare(a.id)))
        if (!started.current) { pageCursor.current = metadata?.cursor; setMore(!!metadata?.hasMore) }
        setCached(!!metadata?.fromCache); setPending(!!metadata?.hasPendingWrites); setPhase('ready')
      }, () => { if (active) setPhase('error') })
    } catch { setPhase('error') }
    return () => { active = false; generation.current++; stop?.() }
  }, [kind, retry])
  async function loadPage() {
    const load = getBackend().zoneChangePage
    if (!load || paging.current) return
    paging.current = true; setLoadingPage(true); setPageError(null)
    const version = generation.current
    if (!started.current) { setOlder(changes); started.current = true }
    try {
      const page = await load(pageCursor.current)
      if (generation.current !== version) return
      setOlder(previous => [...new Map([...previous, ...page.records].map(change => [change.id, change])).values()])
      pageCursor.current = page.cursor; started.current = true; setMore(page.hasMore); setLimit(value => value + 30)
    } catch { if (generation.current === version) setPageError('Older history could not load. Reconnect and retry.') }
    finally { if (generation.current === version) { paging.current = false; setLoadingPage(false) } }
  }
  const merged = new Map(older.map(change => [change.id, change])); changes.forEach(change => merged.set(change.id, change))
  const filtered = [...merged.values()].sort((a, b) => (b.changedAt ?? 0) - (a.changedAt ?? 0) || b.id.localeCompare(a.id)).filter(change => !zoneId || change.zoneId === zoneId)
  return <section className="mt-5 rounded-xl border border-line bg-ink-2 p-4" aria-label="Zone status history">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-display text-xl text-paper">Zone status history</h3>
      <label className="grid w-full min-w-0 gap-2 text-xs text-muted">Coastal area
        <select aria-label="Filter zone history" value={zoneId} onChange={event => { setZoneId(event.target.value); setLimit(30) }} className="min-h-11 w-full min-w-0 rounded-lg border border-line bg-ink p-2 text-paper">
          <option value="">All zones</option>{zones.map(zone => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
        </select>
      </label>
    </div>
    {zoneId && <p className="mt-2 text-sm text-paper [overflow-wrap:anywhere]">{zones.find(zone => zone.id === zoneId)?.name ?? zoneId}</p>}
    <details className="mt-3 text-xs leading-relaxed text-muted"><summary className="cursor-pointer py-2">About this history</summary>
      <p>Recorded changes from this upgrade onward. Earlier changes were not stored and cannot be reconstructed.</p>
      <p className="mt-2">Recent changes load first. The coastal-area filter applies to loaded pages. Older pages are snapshots; retry history to refresh them.</p>
    </details>
    <p className="mt-2 font-mono text-[10px] text-faint">{kind === 'demo' ? 'Local sample history' : pending ? 'Awaiting server confirmation' : !online || cached ? 'Saved on this device · may be out of date' : phase === 'ready' ? 'Server-delivered history' : 'History connection pending'}</p>
    {phase === 'loading' && <p role="status" className="mt-4 text-sm text-muted">Loading zone history…</p>}
    {phase === 'error' && <p role="alert" className="mt-4 text-sm text-muted">Zone history could not load. <button type="button" onClick={() => setRetry(value => value + 1)} className="text-accent underline">Retry history</button></p>}
    {phase === 'unsupported' && <p className="mt-4 text-sm text-muted">Zone history is unavailable in this version.</p>}
    {phase === 'ready' && !filtered.length && <p className="mt-4 text-sm text-muted">{more ? 'No matching status changes in loaded pages. Older pages may contain more.' : `No recorded status changes ${zoneId ? 'for this zone' : 'yet'}.`}</p>}
    {!!filtered.length && <ol className="mt-4 space-y-3">{filtered.slice(0, limit).map(change => <li key={change.id} className="rounded-lg border border-line p-3 [overflow-wrap:anywhere]">
      <p className="text-sm font-semibold text-paper">{zones.find(zone => zone.id === change.zoneId)?.name ?? change.zoneId}</p>
      <p className="mt-1 text-xs text-muted">{zoneStatusMeta(change.fromStatus).label} → {zoneStatusMeta(change.toStatus).label}</p>
      <p className="mt-1 font-mono text-[10px] text-faint">{formatRecordTime(change.changedAt, change.changedAtPending)}</p>
      {change.note && <p className="mt-2 whitespace-pre-wrap text-sm text-paper/85">{change.note}</p>}
      {change.reportId && <p className="mt-2 font-mono text-[10px] text-faint">Related report: {change.reportId}</p>}
    </li>)}</ol>}
    {filtered.length > limit && <button type="button" onClick={() => setLimit(value => value + 30)} className="mt-4 text-sm text-accent underline">Show more changes ({filtered.length - limit} remaining)</button>}
    {more && <button type="button" disabled={loadingPage || !online} onClick={() => void loadPage()} className="mt-4 min-h-11 text-sm text-accent underline disabled:opacity-40">{loadingPage ? 'Loading older changes…' : 'Load older status changes'}</button>}
    {pageError && <p role="alert" className="mt-3 text-sm text-muted">{pageError}</p>}
  </section>
}
