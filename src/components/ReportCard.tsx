import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useReducedMotion } from '../motion/preferences'
import { MOTION, tween } from '../motion/tokens'
import { StatusPip } from './StatusPip'
import { formatRecordTime, formatRelative } from '../lib/format'
import { reportLabel, reportTheme } from '../styles/statusTheme'
import type { Report } from '../types'

/**
 * One report in the admin review queue.
 *
 * Approve deliberately reads as the heavier, more consequential action: it is
 * the one that flips a whole zone to advisory and pushes a public warning, so
 * it gets the solid fill while Reject stays an outline. That asymmetry is the
 * point — on a queue of twenty reports, the destructive-ish choice should not
 * be as easy to hit by accident as the safe one.
 *
 * Both buttons carry hover and press states, and the whole card dims its
 * controls while `busy` so a double-tap cannot fire two writes.
 *
 * MOTION:
 * - Exit: opacity 1→0, y 0→-8px, 220ms ease-in
 * - No success animation before the write completes; the store owns confirmation.
 * - Reduced motion: instant removal
 */
export function ReportCard({
  report,
  zoneName,
  busy,
  onApprove,
  onReject,
}: {
  report: Report
  zoneName: string
  busy: boolean
  onApprove: () => void | Promise<void>
  onReject: () => void | Promise<void>
}) {
  const isPending = report.status === 'pending'
  const theme = reportTheme(report.status)
  const reduceMotion = useReducedMotion()
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const lock = useRef(false)
  const alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function run(kind: 'approve' | 'reject', callback: () => void | Promise<void>) {
    if (busy || lock.current || !isPending) return
    lock.current = true
    setAction(kind)
    try { await callback() }
    catch { /* The caller owns the error notice; leave the card retryable. */ }
    finally { lock.current = false; if (alive.current) setAction(null) }
  }
  const waiting = busy || action !== null

  return (
    <motion.li
      layout={!reduceMotion}
      aria-busy={waiting}
      initial={false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        reduceMotion
          ? { opacity: 0, transition: { duration: 0 } }
          : {
              opacity: 0,
              y: -8,
              scale: 0.98,
              transition: tween(false, MOTION.time.exit),
            }
      }
      transition={tween(reduceMotion)}
      className={`relative min-w-0 overflow-hidden rounded-xl border bg-ink-2 transition-colors duration-[var(--motion-base)] ${
        isPending ? 'border-line hover:border-line-soft' : 'border-line/60'
      }`}
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: isPending ? theme.hex : 'transparent' }}
        aria-hidden="true"
      />

      <div className="p-4 pl-5 [overflow-wrap:anywhere] lg:p-5 lg:pl-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display rounded-md border border-line bg-ink-3 px-2 py-1 text-sm leading-none text-paper">
            {zoneName}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${theme.pillClass}`}
          >
            <StatusPip size="xs" hex={theme.hex} pulses={isPending} trigger={report.status} />
            {reportLabel(report.status)}
          </span>
          <span className="ml-auto font-mono text-[10px] text-faint">
            {report.submittedAtPending ? 'Awaiting server timestamp' : report.submittedAt === null ? 'Date unavailable' : formatRelative(report.submittedAt)}
          </span>
        </div>

        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-paper/85">
          {report.description}
        </p>

        {report.photoUrl && (
          <a
            href={report.photoUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="group mt-3 block overflow-hidden rounded-lg border border-line"
          >
            <img
              src={report.photoUrl}
              alt="Reported conditions attachment"
              loading="lazy"
              className="h-32 w-full object-cover transition-transform duration-[var(--motion-reveal)] motion-safe:group-hover:scale-[1.02] sm:h-40"
            />
          </a>
        )}

        <p className="mt-3 font-mono text-[10px] text-faint">
          Submitted {formatRecordTime(report.submittedAt, report.submittedAtPending)} · id{' '}
          <span className="text-faint/80">{report.id}</span>
        </p>

        {isPending ? (
          <div className="mt-3.5 flex gap-2">
            <motion.button
              type="button"
              onClick={() => void run('approve', onApprove)}
              disabled={waiting}
              className="motion-press group relative flex-1 overflow-hidden rounded-lg bg-advisory px-3 py-2.5 text-sm font-semibold text-ink transition-transform duration-[var(--motion-base)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-[var(--motion-pulse)] motion-safe:group-hover:translate-x-full"
              />
              <span className="relative">
                {action === 'approve' ? 'Approving…' : 'Approve → advisory'}
              </span>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => void run('reject', onReject)}
              disabled={waiting}
              className="motion-press flex-1 rounded-lg border border-line px-3 py-2.5 text-sm font-semibold text-paper/80 transition-colors duration-[var(--motion-base)] hover:border-line-soft hover:bg-white/5 hover:text-paper disabled:cursor-not-allowed disabled:opacity-45"
            >
              {action === 'reject' ? 'Rejecting…' : 'Reject'}
            </motion.button>
          </div>
        ) : (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            Already reviewed — no further action in the MVP
          </p>
        )}
      </div>

    </motion.li>
  )
}
