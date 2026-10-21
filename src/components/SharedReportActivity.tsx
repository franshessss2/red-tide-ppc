import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Bell, Check, ChevronRight, Radio, X } from 'lucide-react'
import { useAppStore } from '../store'
import { activityCursor, connectionSummary, observeReports, type ReportEvent } from '../lib/sharedActivity'
import { formatRecordTime } from '../lib/format'
import { useReducedMotion } from '../motion/preferences'
import '../styles/shared-activity.css'

function subscribeNetwork(notify: () => void) {
  window.addEventListener('online', notify); window.addEventListener('offline', notify)
  return () => { window.removeEventListener('online', notify); window.removeEventListener('offline', notify) }
}
const statusText = { pending: 'Awaiting admin review', confirmed: 'Confirmed by admin', rejected: 'Rejected by admin' }

/** Read-only activity presentation. It never writes records or changes the map camera. */
export function SharedReportActivity() {
  const reports = useAppStore(state => state.reports)
  const zones = useAppStore(state => state.zones)
  const reportsFeed = useAppStore(state => state.reportsFeed)
  const zonesFeed = useAppStore(state => state.zonesFeed)
  const kind = useAppStore(state => state.backendKind)
  const retry = useAppStore(state => state.retryFeeds)
  const online = useSyncExternalStore(subscribeNetwork, () => navigator.onLine, () => false)
  const connection = connectionSummary(kind, online, zonesFeed, reportsFeed)
  const cursor = useRef(activityCursor())
  const backend = useRef(kind)
  const [unread, setUnread] = useState(0)
  const [arrival, setArrival] = useState<ReportEvent | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  const open = phase !== 'closed'
  const reduceMotion = useReducedMotion()
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
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

  const selected = reports.find(report => report.id === selectedId)
  const zoneName = (zoneId: string) => zones.find(zone => zone.id === zoneId)?.name ?? 'Zone unavailable'
  function showActivity() {
    setSelectedId(arrival?.reportId ?? null)
    setArrival(null); setUnread(0); setPhase('open')
  }
  return createPortal(<>
    <div className="report-sync-dock" data-map={location.pathname === '/map'}>
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
        <div className="report-sync-connection"><Radio size={18} aria-hidden="true" /><div>
          <h3>{connection.label}</h3><p>{connection.detail}</p>
          {kind === 'firebase' && !connection.live && <button type="button" onClick={() => retry()}>Retry connection</button>}
        </div></div>
        <p className="report-sync-note">Public reports stay pending until an authorized administrator reviews them. A report alone does not change a zone warning.</p>
        {selected ? <article className="report-sync-detail">
          <button type="button" onClick={() => setSelectedId(null)}>← All reports</button>
          <h3>{zoneName(selected.zoneId)}</h3><p className="report-sync-tag">{statusText[selected.status]}</p>
          <p className="report-sync-description">{selected.description}</p>
          <p className="report-sync-date">Submitted {formatRecordTime(selected.submittedAt, selected.submittedAtPending)}</p>
          <p className="report-sync-id">Report ID: {selected.id}</p>
        </article> : <>
          <div className="report-sync-list-heading"><h3>Latest reports</h3><span>{reports.length} received</span></div>
          {reports.length === 0 ? <p className="report-sync-empty">{connection.live ? 'No reports received yet.' : 'No reports available on this device yet.'}</p> :
            <ul className="report-sync-list">{reports.slice(0, 30).map(report => <li key={report.id}>
              <button type="button" onClick={() => setSelectedId(report.id)}>
                <span className="report-sync-icon" aria-hidden="true">{report.status === 'pending' ? <Bell size={16} /> : <Check size={16} />}</span>
                <span><strong>{zoneName(report.zoneId)}</strong><small>{statusText[report.status]}</small><small>{formatRecordTime(report.submittedAt, report.submittedAtPending)}</small></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>)}</ul>}
          {reports.length > 30 && <p className="report-sync-note">Showing the latest 30 reports.</p>}
        </>}
        <p className="report-sync-clearance">Community records, not an official clearance.</p>
      </div>
    </dialog>}
  </>, document.body)
}
