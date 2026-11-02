import { useEffect, useRef, useState } from 'react'
import { getBackend } from './backend'
import { useAppStore } from '../store'
import type { Report } from '../types'

/** Older pages are a read-only snapshot, separate from the live activity feed. */
export function useReportArchive() {
  const current = useAppStore(state => state.reports)
  const kind = useAppStore(state => state.backendKind)
  const limited = useAppStore(state => state.reportsLimited)
  const liveCursor = useAppStore(state => state.reportsCursor)
  const liveMore = useAppStore(state => state.reportsHasMore)
  const [older, setOlder] = useState<Report[]>([])
  const [allRecords, setAllRecords] = useState(false)
  const [started, setStarted] = useState(false)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cursor = useRef<unknown>(undefined)
  const busy = useRef(false)
  const anchored = useRef(false)
  const generation = useRef(0)
  useEffect(() => {
    generation.current++; cursor.current = undefined; busy.current = false; anchored.current = false
    setOlder([]); setStarted(false); setMore(false); setLoading(false); setError(null)
    return () => { generation.current++ }
  }, [kind, allRecords])
  const records = new Map(older.map(report => [report.id, report]))
  if (!allRecords) current.forEach(report => records.set(report.id, report))
  async function load() {
    const backend = getBackend()
    if (!backend.reportPage || busy.current) return
    busy.current = true; setLoading(true); setError(null)
    const token = generation.current
    const anchor = anchored.current ? cursor.current : allRecords ? undefined : liveCursor
    // Keep the boundary records if the live window advances while browsing.
    if (!anchored.current) {
      cursor.current = anchor; anchored.current = true
      if (!allRecords) setOlder(current)
    }
    try {
      const page = await backend.reportPage(anchor, allRecords)
      if (generation.current !== token) return
      setOlder(previous => [...new Map([...previous, ...page.records].map(report => [report.id, report])).values()])
      cursor.current = page.cursor; setStarted(true); setMore(page.hasMore)
    } catch (failure) { if (generation.current === token) setError(failure instanceof Error ? failure.message : 'Could not load older reports.') }
    finally { if (generation.current === token) { busy.current = false; setLoading(false) } }
  }
  function refresh() { generation.current++; cursor.current = undefined; busy.current = false; anchored.current = false; setOlder([]); setStarted(false); setMore(false); setLoading(false); setError(null) }
  return { records: [...records.values()].sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0) || b.id.localeCompare(a.id)),
    allRecords, setAllRecords, loading, error, load, refresh, limited, hasMore: started ? more : allRecords || liveMore }
}
