/** Every imperative sequence owns its work. Disposal invalidates callbacks before cancellation. */
export function createMotionScope() {
  let disposed = false
  const cleanups = new Set<() => void>()
  const own = (cleanup: () => void) => {
    if (disposed) cleanup()
    else cleanups.add(cleanup)
    return cleanup
  }
  const guard = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    if (!disposed) fn(...args)
  }
  return {
    get active() { return !disposed },
    own,
    guard,
    timeout(fn: () => void, ms: number) {
      let cancel: () => void
      const id = window.setTimeout(() => { cleanups.delete(cancel); if (!disposed) fn() }, ms)
      cancel = own(() => window.clearTimeout(id))
      return cancel
    },
    frame(fn: FrameRequestCallback) {
      let cancel: () => void
      const id = requestAnimationFrame(time => { cleanups.delete(cancel); if (!disposed) fn(time) })
      cancel = own(() => cancelAnimationFrame(id))
      return cancel
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const cleanup of cleanups) cleanup()
      cleanups.clear()
    },
  }
}
export type MotionScope = ReturnType<typeof createMotionScope>
