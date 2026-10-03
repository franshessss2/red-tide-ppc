import { useId } from 'react'
import { LayoutGroup, motion, useMotionValue, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { ZONE_STATUS_ORDER } from '../lib/status'
import { useReducedMotion } from '../motion/preferences'
import { spring } from '../motion/tokens'
import { usePulse } from '../motion/usePulse'
import { resolveActiveStatus } from '../motion/statusKey'
import { zoneLabel, zoneTheme } from '../styles/statusTheme'
import type { ZoneStatus } from '../types'
import { ZoneStatusIcon } from './ZoneStatusIcon'

/**
 * The status key: warning / review / unavailable / no-alert record counts, fixed
 * top-left over the map.
 *
 * WHAT IT IS — AND WHAT IT IS NOT
 * --------------------------------
 * This is the small pills row from the original top-left chrome, restored as
 * a plain, fixed, always-visible element. It is deliberately NOT part of the
 * advisory drawer (`AdvisoryDrawer.tsx`): it never moves, never clips, and
 * has no drag surfaces, no transform, and no toggle. A previous pass merged
 * the pills and the gauge card into one swipeable panel; that merge shipped a
 * rendering bug (content bleeding outside the panel mid-drag) and was split
 * back apart — this file is the pills half of that split.
 *
 * The row keeps its translucent blurred chips (`bg-ink-2/88 backdrop-blur`):
 * that styling is safe here because this subtree is never transformed — the
 * only motion value applied is `opacity` on the wrapper, and an opacity-only
 * ancestor does not disturb backdrop-filter compositing the way a translated
 * one does on mobile GPUs. (The drawer, whose card track translates, uses a
 * solid background for exactly that reason — see `AdvisoryDrawer.tsx`.)
 *
 * Chrome fade (optional):
 *   The row can fade with a progress value (invisible chrome also drops its
 *   pointer events, so it can never swallow a map gesture). The map page no
 *   longer fades it — the bottom sheet that drove the fade is gone — so the
 *   prop is optional and defaults to a constant, always-visible 1. The
 *   wrapper itself is `pointer-events-none` so the map stays interactive
 *   everywhere except on the chips.
 */

export interface StatusKeyProps {
  counts: Record<ZoneStatus, number>
  ready?: boolean
  /** Optional fade driver; defaults to always visible. */
  chromeOpacity?: MotionValue<number>
  /**
   * Status the shared indicator rests on. Defaults to the worst status with
   * a count — MapPage passes the selected zone's status to override it.
   */
  activeStatus?: ZoneStatus | null
}

export function StatusKey({ counts, chromeOpacity, activeStatus, ready = true }: StatusKeyProps) {
  const groupId = useId()
  const fallbackOpacity = useMotionValue(1)
  const opacity = chromeOpacity ?? fallbackOpacity


  // Chips re-enable pointer events only while the chrome is actually
  // visible — invisible chrome must never eat map gestures.
  const chipsPointerEvents = useTransform(opacity, (value): string =>
    value < 0.1 ? 'none' : 'auto',
  )

  const active = activeStatus ?? resolveActiveStatus(null, counts)

  return (
    <motion.div
      style={{ opacity }}
      className="map-status-key pointer-events-none absolute left-3 top-[4.5rem] z-[var(--layer-chrome)] max-w-[calc(100vw-5rem)] mt-[env(safe-area-inset-top)]"
      data-testid="status-key"
    >
      <motion.div
        role="group"
        aria-label="Zone status key"
        style={{ pointerEvents: chipsPointerEvents as unknown as 'auto' }}
        className="flex select-none flex-wrap items-center gap-1.5"
      >
        <LayoutGroup id={groupId}>
        {ZONE_STATUS_ORDER.map((status) => (
          <StatusChip
            key={status}
            status={status}
            count={ready ? counts[status] ?? 0 : null}
            active={status === active}
          />
        ))}
        </LayoutGroup>
      </motion.div>
    </motion.div>
  )
}

/**
 * One status count pill. The same chip as the original floating legend, plus
 * two live details:
 *
 *  - the SHARED INDICATOR: exactly one chip hosts a `layoutId` layer; when the
 *    active status changes (selection or counts), motion moves that single
 *    element from the old chip's bounds to the new one — the highlight slides
 *    between pills while the pills themselves never move;
 *  - critical counts appear immediately; the surrounding indicator acknowledges changes.
 *
 * The indicator is a static-tinted layer (no looping animation, no shadow
 * animation — a transform-only layout move), so the row stays as cheap as
 * before.
 */
function StatusChip({
  status,
  count,
  active,
}: {
  status: ZoneStatus
  count: number | null
  active: boolean
}) {
  const theme = zoneTheme(status)
  const label = zoneLabel(status)
  const reduceMotion = useReducedMotion()

  return (
    <span
      data-status={status}
      className="relative isolate inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-2/88 py-1 pl-2 pr-2 backdrop-blur-md"
    >
      {active && (
        <motion.span
          layoutId="status-key-active-indicator"
          data-testid="status-key-indicator"
          className="absolute inset-0 -z-10 rounded-full"
          style={{ backgroundColor: theme.hex, opacity: 0.16 }}
          transition={spring(reduceMotion)}
        />
      )}
      <span style={{ color: theme.hex }}><ZoneStatusIcon status={status} /></span>
      <span className="font-display text-[11px] leading-none tracking-[0.03em] text-paper/85">
        {label}
      </span>
      <StatusCount count={count} color={theme.hex} />
    </span>
  )
}

/**
 * The final count stays readable while this gives the digit itself a
 * short acknowledgement too, so the data that changed is the thing that
 * briefly expands. It is intentionally one-shot and transform-only (plus a
 * tiny text shadow) rather than a loop.
 */
function StatusCount({ count, color }: { count: number | null; color: string }) {
  const ref = usePulse<HTMLSpanElement>(count)

  return (
    <span
      ref={ref}
      className="inline-block origin-center font-mono text-[10px] leading-none"
      style={{ color }}
    >
      {count ?? '—'}
    </span>
  )
}
