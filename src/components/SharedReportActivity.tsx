import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Bell, Check, ChevronRight, X } from 'lucide-react'
import { LayoutGroup, motion } from 'motion/react'
import { useAppStore } from '../store'
import type { Report } from '../types'
import { activityCursor, connectionSummary, observeReports, type ReportEvent } from '../lib/sharedActivity'
import { formatRecordTime } from '../lib/format'
import { useReducedMotion } from '../motion/preferences'
import '../styles/shared-activity.css'
import { MapFeedStatus } from './DataProvenance'
import { ConnectionPanel } from './ConnectionPanel'
import { ReportTimeline } from './ReportTimeline'
import { RecentChanges } from './RecentChanges'
import { ZoneHistory } from './ZoneHistory'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { getBackend } from '../lib/backend'
import { useReportArchive } from '../lib/useReportArchive'
import { ReportArchiveControls } from './ReportArchiveControls'
import { ReportOutbox } from './ReportOutbox'
import { OPEN_RECEIPTS_EVENT } from '../lib/reportOutbox'
import { ActivityViewport } from './ActivityViewport'
import { tween, MOTION } from '../motion/tokens'
import '../styles/community-tracking.css'

const statusText = { pending: 'Awaiting admin review', confirmed: 'Confirmed by admin', rejected: 'Rejected by admin' }

/** Public history and device receipts; only an explicit outbox Send writes a report. */
export function SharedReportActivity() {
  const reports = useAppStore(state => state.reports)
  const zones = useAppStore(state => state.zones)
  const reportsFeed = useAppStore(state => state.reportsFeed)
  const zonesFeed = useAppStore(state => state.zonesFeed)
  const kind = useAppStore(state => state.backendKind)
  const online = useOnlineStatus()
  const connection = connectionSummary(kind, online, zonesFeed, reportsFeed)
  const cursor = useRef(activityCursor())
  const backend = useRef(kind)
  const [unread, setUnread] = useState(0)
  const [arrival, setArrival] = useState<ReportEvent | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'history' | 'changes' | 'mine'>('history')
  const [direction, setDirection] = useState(1)
  const archive = useReportArchive()
  const [remoteReport, setRemoteReport] = useState<Report | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const lookupGeneration = useRef(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | Report['status']>('all')
  const [limit, setLimit] = useState(30)
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  const open = phase !== 'closed'
  const reduceMotion = useReducedMotion()
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const id = useId()
  const location = useLocation()
  const requestClose = useCallback(() => { lookupGeneration.current++; setLookingUp(false); setPhase(reduceMotion ? 'closed' : 'closing') }, [reduceMotion])
  function switchView(next: typeof view) {
    setDirection(['history', 'changes', 'mine'].indexOf(next) >= ['history', 'changes', 'mine'].indexOf(view) ? 1 : -1)
    lookupGeneration.current++; setLookingUp(false); setLookupError(null)
    setView(next); setSelectedId(null)
  }
  useEffect(() => {
    const openMine = () => { setDirection(1); setSelectedId(null); setView('mine'); setPhase('open') }
    window.addEventListener(OPEN_RECEIPTS_EVENT, openMine)
    return () => { window.removeEventListener(OPEN_RECEIPTS_EVENT, openMine); lookupGeneration.current++ }
  }, [kind])
  async function lookupReport(id: string) {
    const lookup = getBackend().getReport
    if (!lookup) { setLookupError('Direct report lookup is unavailable in this version.'); return }
    const generation = ++lookupGeneration.current
    setLookingUp(true); setLookupError(null)
    try {
      const report = await lookup(id.trim())
      if (generation !== lookupGeneration.current) return
      if (!report) { setLookupError('No shared report was found with that ID.'); return }
      setDirection(1); setRemoteReport(report); setSelectedId(report.id)
    } catch { if (generation === lookupGeneration.current) setLookupError('Could not open the shared report. Reconnect and retry; your recorded receipt stays in My reports.') }
    finally { if (generation === lookupGeneration.current) setLookingUp(false) }
  }

  useEffect(() => {
    if (backend.current !== kind) {
      cursor.current = activityCursor(); backend.current = kind
      setUnread(0); setArrival(null); setSelectedId(null)
      setRemoteReport(null); setLookupError(null); setLookingUp(false)
    }
    if (kind !== 'firebase') return
    const events = observeReports(cursor.current, reports, reportsFeed)
    if (!events.length) return
    setUnread(count => count + events.length)
    setArrival(events[0])
  }, [kind, reports, reportsFeed])
  useEffect(() => {
    if (!arrival) return
    const timer = window.setTimeout(() => setArrival(null), 6500)
    return () => window.clearTimeout(timer)
  }, [arrival])
  useEffect(() => {
    if (phase !== 'closing') return
    const timer = window.setTimeout(() => setPhase('closed'), reduceMotion ? 0 : 220)
    return () => window.clearTimeout(timer)
  }, [phase, reduceMotion])
  useEffect(() => {
    if (!open) return
    const node = dialog.current!
    const overflow = document.body.style.overflow
    node.showModal(); document.body.style.overflow = 'hidden'
    return () => { node.close(); document.body.style.overflow = overflow; trigger.current?.focus() }
  }, [open])

  useEffect(() => {
    if (selectedId && open) detailHeading.current?.focus()
  }, [selectedId, open])

  const selected = remoteReport?.id === selectedId ? remoteReport : archive.records.find(report => report.id === selectedId)
  function selectReport(id: string) { lookupGeneration.current++; setLookingUp(false); setDirection(1); setRemoteReport(null); setSelectedId(id) }
  function sceneEntered() {
    if (!open) return
    if (selectedId) { detailHeading.current?.focus(); return }
    if (document.activeElement === document.body || document.activeElement === dialog.current) {
      dialog.current?.querySelector<HTMLButtonElement>('.report-activity-views button[aria-pressed="true"]')?.focus()
    }
  }
  const zoneName = (zoneId: string) => zones.find(zone => zone.id === zoneId)?.name ?? 'Zone unavailable'
  const filtered = archive.records.filter(report => (filter === 'all' || report.status === filter) &&
    `${report.id} ${report.description} ${zoneName(report.zoneId)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  function showActivity() {
    setRemoteReport(null)
    setSelectedId(arrival?.reportId ?? null)
    setArrival(null); setUnread(0); setView('history'); setPhase('open')
  }
  return createPortal(<>
    <div className="report-sync-dock" data-map={location.pathname === '/map'}>
      {location.pathname === '/map' && <div className="report-sync-map-source"><MapFeedStatus /></div>}
      {arrival && <div className="report-sync-arrival" key={arrival.key}>
        <span aria-hidden="true">{arrival.kind === 'received' ? 'New report' : 'Review updated'}</span>
        <span className="truncate">{zoneName(arrival.zoneId)}</span>
      </div>}
      <button ref={trigger} type="button" className="report-sync-trigger" onClick={showActivity}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={`Report activity · ${connection.label}${unread ? ` · ${unread} new updates` : ''}`}>
        <Bell size={16} aria-hidden="true" />
        <span>Reports</span><span className="report-sync-divider" />
        <span className="report-sync-state" data-live={connection.live}><i aria-hidden="true" />{connection.label}</span>
        {unread > 0 && <span className="report-sync-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
    </div>
    {open && <dialog ref={dialog} id={id} className="report-sync-dialog" data-closing={phase === 'closing'}
      aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); requestClose() }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose()
      }}>
      <header className="report-sync-heading">
        <div><p className="report-sync-eyebrow">One shared coastal feed</p><h2 id={`${id}-title`}>Report activity</h2></div>
        <button type="button" onClick={requestClose} aria-label="Close report activity"><X size={19} /></button>
      </header>
      <div className="report-sync-content">
        <ConnectionPanel />
        <LayoutGroup id={`report-views-${id}`}><div className="report-activity-views" aria-label="Activity view">
          {([{ key: 'history', label: 'Report history' }, { key: 'changes', label: 'What changed?' }, { key: 'mine', label: 'My reports' }] as const).map(entry => <button key={entry.key} type="button" aria-pressed={view === entry.key} onClick={() => switchView(entry.key)}>
            {view === entry.key && <motion.i className="report-activity-selected" aria-hidden="true" layoutId="selected-view" transition={tween(reduceMotion, MOTION.time.base)} />}
            <span className="report-activity-view-label">{entry.label}{entry.key === 'history' && <> <small>{archive.records.length}</small></>}</span>
          </button>)}
        </div></LayoutGroup>
        <p className="report-sync-note">Public reports stay pending until an authorized administrator reviews them. A report alone does not change a zone warning.</p>
        {lookingUp && <p role="status" className="text-sm text-muted">Opening report receipt…</p>}
        {lookupError && <p role="alert" className="text-sm text-advisory">{lookupError}</p>}
        <ActivityViewport sceneKey={selected ? `report:${selected.id}` : view} direction={direction} onEntered={sceneEntered}>
        {selected ? <article className="report-sync-detail">
          <button type="button" onClick={() => { setDirection(-1); setSelectedId(null) }}>← {view === 'mine' ? 'My reports' : view === 'changes' ? 'Back to changes' : 'All reports'}</button>
          <h3 ref={detailHeading} tabIndex={-1}>{zoneName(selected.zoneId)}</h3><p className="report-sync-tag">{statusText[selected.status]}</p>
          <p className="report-sync-description">{selected.description}</p>
          <p className="report-sync-date">Submitted {formatRecordTime(selected.submittedAt, selected.submittedAtPending)}</p>
          <p className="report-sync-id">Report ID: {selected.id}</p>
          <ReportTimeline report={selected} zone={zones.find(zone => zone.id === selected.zoneId)} />
        </article> : view === 'mine' ? <ReportOutbox onReport={id => void lookupReport(id)} /> : view === 'changes' ? <><ZoneHistory /><RecentChanges reports={reports} zones={zones} source={kind} reportsFeed={reportsFeed} zonesFeed={zonesFeed} onReport={selectReport} /></> : <>
          <div className="report-sync-list-heading"><h3>Report history</h3><span>{archive.records.length} loaded</span></div>
          <ReportArchiveControls archive={archive} />
          <div className="report-history-tools">
            <label><span>Find a report</span><input type="search" value={query} placeholder="Report ID, zone or observation" onChange={event => { setQuery(event.target.value); setLimit(30) }} /></label>
            <label><span>Review status</span><select value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setLimit(30) }}><option value="all">All reports</option><option value="pending">Awaiting review</option><option value="confirmed">Approved</option><option value="rejected">Rejected</option></select></label>
          </div>
          {/^[a-zA-Z0-9_-]{1,200}$/.test(query.trim()) && <button type="button" disabled={lookingUp} className="mb-3 min-h-11 text-xs text-accent underline" onClick={() => void lookupReport(query.trim())}>Open exact report ID</button>}
          {filtered.length === 0 ? <p className="report-sync-empty">{archive.allRecords && !archive.records.length && archive.hasMore ? 'Load an archive page to browse all records, including undated history.' : archive.limited ? 'No matching reports in loaded pages. Older pages may contain more.' : reports.length ? 'No reports match your search.' : connection.live ? 'No reports received yet.' : 'No reports available on this device yet.'}</p> :
            <ul className="report-sync-list">{filtered.slice(0, limit).map((report, index) => <li key={report.id} style={{ animationDelay: `${Math.min(index, 4) * 18}ms` }}>
              <button type="button" onClick={() => selectReport(report.id)}>
                <span className="report-sync-icon" aria-hidden="true">{report.status === 'pending' ? <Bell size={16} /> : <Check size={16} />}</span>
                <span><strong>{zoneName(report.zoneId)}</strong><small>{statusText[report.status]}</small><small>{formatRecordTime(report.submittedAt, report.submittedAtPending)}</small></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>)}</ul>}
          {filtered.length > limit && <button type="button" className="report-history-more" onClick={() => setLimit(value => value + 30)}>Show more reports ({filtered.length - limit} remaining)</button>}
        </>}
        </ActivityViewport>
        <p className="report-sync-clearance">Community records, not an official clearance.</p>
      </div>
    </dialog>}
  </>, document.body)
}
