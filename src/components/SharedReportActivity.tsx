import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Bell, Check, ChevronRight, X } from 'lucide-react'
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
import { useOnlineStatus } from '../lib/useOnlineStatus'
import '../styles/community-tracking.css'

const statusText = { pending: 'Awaiting admin review', confirmed: 'Confirmed by admin', rejected: 'Rejected by admin' }

/** Read-only activity presentation. It never writes records or changes the map camera. */
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
  const [view, setView] = useState<'history' | 'changes'>('history')
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
  const requestClose = useCallback(() => setPhase(reduceMotion ? 'closed' : 'closing'), [reduceMotion])

  useEffect(() => {
    if (backend.current !== kind) {
      cursor.current = activityCursor(); backend.current = kind
      setUnread(0); setArrival(null); setSelectedId(null)
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

  const selected = reports.find(report => report.id === selectedId)
  const zoneName = (zoneId: string) => zones.find(zone => zone.id === zoneId)?.name ?? 'Zone unavailable'
  const filtered = reports.filter(report => (filter === 'all' || report.status === filter) &&
    `${report.id} ${report.description} ${zoneName(report.zoneId)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  function showActivity() {
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
        <div className="report-activity-views" aria-label="Activity view">
          <button type="button" aria-pressed={view === 'history'} onClick={() => { setView('history'); setSelectedId(null) }}>Report history <span>{reports.length}</span></button>
          <button type="button" aria-pressed={view === 'changes'} onClick={() => { setView('changes'); setSelectedId(null) }}>What changed?</button>
        </div>
        <p className="report-sync-note">Public reports stay pending until an authorized administrator reviews them. A report alone does not change a zone warning.</p>
        {selected ? <article className="report-sync-detail">
          <button type="button" onClick={() => setSelectedId(null)}>← {view === 'changes' ? 'Back to changes' : 'All reports'}</button>
          <h3 ref={detailHeading} tabIndex={-1}>{zoneName(selected.zoneId)}</h3><p className="report-sync-tag">{statusText[selected.status]}</p>
          <p className="report-sync-description">{selected.description}</p>
          <p className="report-sync-date">Submitted {formatRecordTime(selected.submittedAt, selected.submittedAtPending)}</p>
          <p className="report-sync-id">Report ID: {selected.id}</p>
          <ReportTimeline report={selected} zone={zones.find(zone => zone.id === selected.zoneId)} />
        </article> : view === 'changes' ? <RecentChanges reports={reports} zones={zones} source={kind} reportsFeed={reportsFeed} zonesFeed={zonesFeed} onReport={setSelectedId} /> : <>
          <div className="report-sync-list-heading"><h3>Report history</h3><span>{reports.length} received</span></div>
          <div className="report-history-tools">
            <label><span>Find a report</span><input type="search" value={query} placeholder="Report ID, zone or observation" onChange={event => { setQuery(event.target.value); setLimit(30) }} /></label>
            <label><span>Review status</span><select value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setLimit(30) }}><option value="all">All reports</option><option value="pending">Awaiting review</option><option value="confirmed">Approved</option><option value="rejected">Rejected</option></select></label>
          </div>
          {filtered.length === 0 ? <p className="report-sync-empty">{reports.length ? 'No reports match your search.' : connection.live ? 'No reports received yet.' : 'No reports available on this device yet.'}</p> :
            <ul className="report-sync-list">{filtered.slice(0, limit).map(report => <li key={report.id}>
              <button type="button" onClick={() => setSelectedId(report.id)}>
                <span className="report-sync-icon" aria-hidden="true">{report.status === 'pending' ? <Bell size={16} /> : <Check size={16} />}</span>
                <span><strong>{zoneName(report.zoneId)}</strong><small>{statusText[report.status]}</small><small>{formatRecordTime(report.submittedAt, report.submittedAtPending)}</small></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>)}</ul>}
          {filtered.length > limit && <button type="button" className="report-history-more" onClick={() => setLimit(value => value + 30)}>Show more reports ({filtered.length - limit} remaining)</button>}
        </>}
        <p className="report-sync-clearance">Community records, not an official clearance.</p>
      </div>
    </dialog>}
  </>, document.body)
}
