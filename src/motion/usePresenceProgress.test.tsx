// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePresenceProgress } from './usePresenceProgress'
const runs = vi.hoisted(() => [] as { from: number; to: number; stop: ReturnType<typeof vi.fn>; onUpdate: (n: number) => void; onComplete: () => void }[])
let reduce = false
vi.mock('./preferences', () => ({ useReducedMotion: () => reduce }))
vi.mock('motion/react', () => ({ animate: (from: number, to: number, options: { onUpdate: (n: number) => void; onComplete: () => void }) => {
  const stop = vi.fn(); runs.push({ from, to, stop, ...options }); return { stop }
} }))
beforeEach(() => { reduce = false; runs.length = 0 })
describe('reversible presence', () => {
  it('reverses from the current paint and rejects stale exit completion', () => {
    const { result, rerender } = renderHook(({ open }) => usePresenceProgress(open), { initialProps: { open: true } })
    rerender({ open: false })
    const exit = runs.at(-1)!
    act(() => exit.onUpdate(0.4))
    rerender({ open: true })
    expect(runs.at(-1)?.from).toBe(0.4)
    act(() => { exit.onUpdate(0); exit.onComplete() })
    expect(result.current.mounted).toBe(true)
    expect(result.current.progress).toBe(0.4)
    expect(exit.stop).toHaveBeenCalled()
  })
  it('settles and cancels in-flight work when reduced motion changes', () => {
    const { result, rerender } = renderHook(({ open }) => usePresenceProgress(open), { initialProps: { open: true } })
    rerender({ open: false })
    const exit = runs.at(-1)!
    reduce = true
    rerender({ open: false })
    expect(result.current).toEqual({ mounted: false, progress: 0 })
    act(() => exit.onUpdate(0.9))
    expect(result.current.progress).toBe(0)
    expect(exit.stop).toHaveBeenCalled()
  })
  it('stops work on unmount', () => {
    const { unmount } = renderHook(() => usePresenceProgress(true))
    const active = runs.at(-1)!
    unmount()
    expect(active.stop).toHaveBeenCalledTimes(1)
  })
})
