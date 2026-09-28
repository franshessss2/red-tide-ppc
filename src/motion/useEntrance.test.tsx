// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useEntrance } from './useEntrance'
const state = vi.hoisted(() => ({ reduced: false, visible: true, controls: { stop: vi.fn(), set: vi.fn(), start: vi.fn() } }))
vi.mock('motion/react', () => ({ useAnimationControls: () => state.controls }))
vi.mock('./preferences', () => ({ useReducedMotion: () => state.reduced }))
vi.mock('./useReveal', () => ({ useReveal: () => state.visible }))
afterEach(() => { vi.clearAllMocks(); state.reduced = false })
it('cancels pending entrances before closing with no stagger delay, and reverses on reopen', () => {
  const ref = { current: document.createElement('li') }
  const view = renderHook(({ open }) => useEntrance(ref, open, null, 0.32), { initialProps: { open: true } })
  expect(state.controls.start).toHaveBeenLastCalledWith(expect.objectContaining({ opacity: 1, transition: expect.objectContaining({ delay: 0.32 }) }))
  view.rerender({ open: false })
  expect(state.controls.start).toHaveBeenLastCalledWith(expect.objectContaining({ opacity: 0, y: 8, transition: expect.objectContaining({ delay: 0 }) }))
  view.rerender({ open: true })
  expect(state.controls.start).toHaveBeenLastCalledWith(expect.objectContaining({ opacity: 1, y: 0 }))
  view.unmount()
  expect(state.controls.stop).toHaveBeenCalled()
})
it('snaps to the final close state when reduced motion changes mid-exit', () => {
  const ref = { current: document.createElement('li') }
  const view = renderHook(({ open }) => useEntrance(ref, open, null), { initialProps: { open: true } })
  view.rerender({ open: false })
  state.reduced = true; view.rerender({ open: false })
  expect(state.controls.set).toHaveBeenLastCalledWith({ opacity: 0, y: 0 })
})
