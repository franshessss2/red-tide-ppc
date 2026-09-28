import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from '../motion/preferences'
import { createMotionScope } from '../motion/scope'
import { MOTION, spring } from '../motion/tokens'
import { useAppStore } from '../store'

const AUTO_DISMISS_MS = MOTION.time.noticeHold * 1000

/**
 * Floating success/error toast driven by the store.
 *
 * Enter and exit both animate: previously the toast was mounted and unmounted
 * outright, so dismissing one made it vanish between frames. AnimatePresence
 * gives it a short slide-and-fade out, and the auto-dismiss timer is unchanged.
 *
 * The two tones are deliberately not equally loud. Errors take the advisory
 * red and do not auto-dismiss differently — but they read as urgent, while a
 * success sits on the raised surface with an amber tick.
 */
export function Notice({ suppressNotice }: { suppressNotice?: string } = {}) {
  const error = useAppStore((state) => state.error)
  const notice = useAppStore((state) => state.notice)
  const dismissMessages = useAppStore((state) => state.dismissMessages)
  const reduceMotion = useReducedMotion()

  const message = error ?? (notice === suppressNotice ? null : notice)
  useEffect(() => {
    // Consume only this form's duplicate success. Never clear another notice
    // or an error from a concurrent operation.
    if (notice && notice === suppressNotice && !error) dismissMessages()
  }, [notice, suppressNotice, error, dismissMessages])
  useEffect(() => {
    if (!message) return
    const scope = createMotionScope()
    scope.timeout(dismissMessages, AUTO_DISMISS_MS)
    return () => scope.dispose()
  }, [message, dismissMessages])

  const isError = Boolean(error)

  return createPortal(
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          role={isError ? 'alert' : 'status'}
          aria-live={isError ? 'assertive' : 'polite'}
          initial={{ opacity: 0, y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : 10, scale: reduceMotion ? 1 : 0.98 }}
          transition={spring(reduceMotion)}
          className="pointer-events-none fixed inset-x-4 bottom-4 z-[var(--layer-notice)] sm:inset-x-auto sm:right-4 sm:w-96"
        >
          <div
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-ink-2 p-3 ${
              isError
                ? 'border-advisory/40'
                : 'border-line'
            }`}
          >
            <span
              className={`mt-0.5 shrink-0 ${isError ? 'text-advisory' : 'text-accent'}`}
              aria-hidden="true"
            >
              {isError ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-13a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Zm0 9.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </span>
            <p
              className={`flex-1 text-sm leading-snug ${
                isError ? 'text-paper' : 'text-paper/90'
              }`}
            >
              {message}
            </p>
            <button
              type="button"
              onClick={dismissMessages}
              aria-label="Dismiss message"
              className="-mr-1 shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-white/10 hover:text-paper"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.3 5a1 1 0 0 0-1.3 1.4L8.6 10l-3.6 3.6A1 1 0 1 0 6.3 15l3.7-3.6 3.6 3.6a1 1 0 0 0 1.4-1.4L11.4 10l3.6-3.6A1 1 0 0 0 13.7 5L10 8.6 6.3 5Z" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>, document.body
  )
}
