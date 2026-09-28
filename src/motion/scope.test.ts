// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMotionScope } from './scope'
import { MOTION, staggerDelay, tween } from './tokens'
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('motion lifecycle', () => {
  it('cancels a timer and guards stale callbacks after disposal', () => {
    vi.useFakeTimers(); const scope = createMotionScope(); const fn = vi.fn()
    scope.timeout(fn, 100); const stale = scope.guard(fn); scope.dispose(); stale(); vi.runAllTimers()
    expect(fn).not.toHaveBeenCalled()
  })
  it('invalidates queued rAF callbacks even if cancellation arrives too late', () => {
    let callback: FrameRequestCallback = () => {}; const cancel = vi.fn()
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { callback = fn; return 2 })
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const scope = createMotionScope(); const fn = vi.fn(); scope.frame(fn); scope.dispose(); callback(200)
    expect(fn).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledWith(2)
  })
  it('disposes every owned animation exactly once, including late registration', () => {
    const scope = createMotionScope(); const stop = vi.fn(); scope.own(stop); scope.dispose(); scope.dispose()
    expect(stop).toHaveBeenCalledTimes(1)
    const late = vi.fn(); scope.own(late); expect(late).toHaveBeenCalledTimes(1)
  })
  it('removes completed timers from the cleanup set', () => {
    vi.useFakeTimers(); const scope = createMotionScope(); const fn = vi.fn(); scope.timeout(fn, 100)
    vi.advanceTimersByTime(100); scope.dispose(); expect(fn).toHaveBeenCalledTimes(1)
  })
  it('caps staggering so long lists never create seconds of hidden controls', () => {
    expect(staggerDelay(500)).toBe(MOTION.time.staggerLimit)
    expect(staggerDelay(NaN)).toBe(0); expect(staggerDelay(-1)).toBe(0)
  })
  it('removes all duration and delay under reduced motion', () => {
    expect(tween(true, 4, 2)).toMatchObject({ duration: 0, delay: 0 })
    expect(staggerDelay(5, true)).toBe(0)
  })
})
