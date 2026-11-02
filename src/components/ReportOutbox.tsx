import { useEffect, useState } from 'react'
import { getBackend } from '../lib/backend'
import { outboxStorage, type SavedReport } from '../lib/outboxStorage'
import { notifyOutbox, outboxScope, OUTBOX_EVENT, removeOutboxReport, sendOutboxReport } from '../lib/reportOutbox'
import { useAppStore } from '../store'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { formatRecordTime, formatBytes } from '../lib/format'

export function ReportOutbox({ onReport }: { onReport: (id: string) => void }) {
  const kind = useAppStore(state => state.backendKind)
  const online = useOnlineStatus()
  const [records, setRecords] = useState<SavedReport[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [clock, setClock] = useState(Date.now())
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => {
    let active = true, revision = 0
    setReady(false); setRecords([]); setError(null)
    const refresh = () => {
      const version = ++revision
      void outboxStorage.list(outboxScope(getBackend())).then(next => {
        if (active && version === revision) { setRecords(next.sort((a, b) => b.createdAt - a.createdAt)); setReady(true); setClock(Date.now()) }
      }).catch(() => { if (active) { setError('Saved reports could not be read. Device storage may be unavailable.'); setReady(true) } })
    }
    refresh()
    window.addEventListener(OUTBOX_EVENT, refresh); window.addEventListener('focus', refresh)
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(OUTBOX_EVENT) : null
    if (channel) channel.onmessage = refresh
    const timer = window.setInterval(() => setClock(Date.now()), 10000)
    return () => { active = false; window.removeEventListener(OUTBOX_EVENT, refresh); window.removeEventListener('focus', refresh); channel?.close(); clearInterval(timer) }
  }, [kind])
  async function send(id: string) {
    setError(null)
    try { await sendOutboxReport(getBackend(), id) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not send. Your report stays on this device.'); notifyOutbox() }
  }
  async function remove(id: string) {
    try { await removeOutboxReport(getBackend(), id); setConfirmation(null) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not remove the local copy.') }
  }
  return <section aria-label="My reports" className="mt-4">
    <h3 className="font-display text-xl text-paper">My reports on this device</h3>
    <p className="mt-2 text-xs leading-relaxed text-muted">Saved here until you press Send. Keep RTP open while sending; clearing app data removes local copies.</p>
    <p className="mt-2 font-mono text-[10px] text-faint">20 unsent reports · 50 MB · latest 30 receipts · {kind === 'demo' ? 'Sample reports stay local' : 'This device only'}</p>
    {!online && <p className="mt-3 text-xs text-accent">Offline · unsent reports wait for a connection. Recorded receipts remain available below.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-advisory">{error}</p>}
    {!ready ? <p role="status" className="mt-4 text-muted">Reading saved reports…</p> : !records.length && !error ? <p className="mt-4 text-sm text-muted">No saved reports or receipts on this device yet.</p> : null}
    <ol className="mt-4 space-y-3">{records.map(record => {
      const locked = !!record.leaseUntil && record.leaseUntil > clock
      return <li key={record.id} className="rounded-xl border border-line p-3 [overflow-wrap:anywhere]">
        <p className="text-sm font-semibold text-paper">{record.zoneName}</p>
        <p className="mt-1 text-xs text-accent">{record.phase === 'sent' ? kind === 'demo' ? 'Sample report saved · local receipt' : 'Server received · receipt' : locked ? 'Sending / awaiting acknowledgement' : record.phase === 'retry' ? 'Receipt unconfirmed · retry to check' : 'Saved locally · not sent'}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-paper/85">{record.description}</p>
        <p className="mt-2 font-mono text-[10px] text-faint">Saved {formatRecordTime(record.createdAt)}{record.receivedAt ? ` · Received ${formatRecordTime(record.receivedAt)}` : ''}</p>
        <p className="mt-1 font-mono text-[10px] text-faint">{record.id}{record.photo ? ` · Photo saved (${formatBytes(record.photo.size)})` : ''}</p>
        {record.error && <p className="mt-2 text-xs text-muted">{record.error}</p>}
        <div className="report-outbox-actions mt-3 flex flex-wrap gap-3 text-xs">
          {record.phase !== 'sent' ? <button type="button" disabled={!online || locked} className="min-h-11 rounded-lg bg-accent px-3 text-ink disabled:opacity-40" onClick={() => void send(record.id)}>{locked ? 'Awaiting receipt…' : 'Send now'}</button> : <>
            <button type="button" className="min-h-11 text-accent underline" onClick={() => onReport(record.id)}>Open report receipt</button>
            <button type="button" className="min-h-11 text-muted underline" onClick={() => { void navigator.clipboard.writeText(record.id).then(() => setCopied(record.id)).catch(() => setError('Could not copy. Select the report ID above.')) }}>{copied === record.id ? 'ID copied' : 'Copy report ID'}</button>
          </>}
          {!locked && <button type="button" className="min-h-11 text-muted underline" onClick={() => setConfirmation(record.id)}>Remove local {record.phase === 'sent' ? 'receipt' : 'copy'}</button>}
        </div>
        {confirmation === record.id && <div className="mt-2 rounded-lg border border-line p-3 text-xs text-muted"><p>{record.phase === 'sent' ? 'Remove only this device’s receipt? The shared report remains.' : 'Remove the saved text and photo from this device? A send already accepted remotely cannot be undone here.'}</p><button type="button" className="mr-4 min-h-11 text-advisory underline" onClick={() => void remove(record.id)}>Confirm removal</button><button type="button" className="min-h-11 underline" onClick={() => setConfirmation(null)}>Keep it</button></div>}
      </li>
    })}</ol>
  </section>
}
