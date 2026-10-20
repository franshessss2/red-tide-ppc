// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AndroidDownloadButton } from './AndroidDownloadButton'

const preferences = vi.hoisted(() => ({ reduced: false, saveData: false }))
vi.mock('../motion/preferences', () => ({ useReducedMotion: () => preferences.reduced }))
vi.mock('../motion/LandingMotionPolicy', () => ({ useSaveData: () => preferences.saveData }))

function finishFade(target: Element = screen.getByRole('dialog')) {
  fireEvent(target, Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: 'opacity' }))
}

beforeEach(() => {
  preferences.reduced = false
  preferences.saveData = false
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.open = false })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it('only mounts the QR after opening and offers the same download destination', () => {
  render(<AndroidDownloadButton />)
  expect(screen.queryByRole('img')).toBeNull()
  const trigger = screen.getByRole('button', { name: 'Android app download QR code' })
  fireEvent.click(trigger)
  expect(screen.getByRole('dialog', { name: 'Get Red Tide PPC' })).toBeTruthy()
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  const link = screen.getByRole('link', { name: /Open download folder/ })
  expect(link.getAttribute('href')).toBe('https://drive.google.com/drive/folders/1mpUalyCgYrDXoN8L1KP7WVv11_p-VFSJ?usp=sharing')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  expect(screen.getByText(/Android testing build · Sample data/)).toBeTruthy()
})

it('dismisses on Escape or close and restores scrolling and trigger focus', () => {
  render(<AndroidDownloadButton />)
  const trigger = screen.getByRole('button', { name: 'Android app download QR code' })
  trigger.focus()
  fireEvent.click(trigger)
  expect(document.body.style.overflow).toBe('hidden')
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(screen.getByRole('dialog').getAttribute('data-closing')).toBe('true')
  expect(document.body.style.overflow).toBe('hidden')
  // A child transition must not finish the modal's own exit.
  finishFade(screen.getByRole('button', { name: 'Close Android download' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  finishFade()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.body.style.overflow).toBe('')
  expect(document.activeElement).toBe(trigger)
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', { name: 'Close Android download' }))
  finishFade()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it('fades out on a backdrop click and has a bounded fallback if the transition event is lost', () => {
  vi.useFakeTimers()
  render(<AndroidDownloadButton />)
  const trigger = screen.getByRole('button', { name: 'Android app download QR code' })
  fireEvent.click(trigger)
  const modal = screen.getByRole('dialog')
  fireEvent.click(modal, { clientX: -1, clientY: -1 })
  expect(modal.getAttribute('data-closing')).toBe('true')
  act(() => vi.advanceTimersByTime(259))
  expect(screen.getByRole('dialog')).toBe(modal)
  act(() => vi.advanceTimersByTime(1))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  expect(document.body.style.overflow).toBe('')
})

it.each(['reduced', 'saveData'] as const)('dismisses immediately with %s enabled', mode => {
  preferences[mode] = true
  render(<AndroidDownloadButton />)
  fireEvent.click(screen.getByRole('button', { name: 'Android app download QR code' }))
  expect(screen.getByRole('dialog').getAttribute('data-motion')).toBe('static')
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.body.style.overflow).toBe('')
})

it('finishes an exit if reduced motion is enabled mid-fade', () => {
  const view = render(<AndroidDownloadButton />)
  fireEvent.click(screen.getByRole('button', { name: 'Android app download QR code' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Android download' }))
  preferences.reduced = true
  view.rerender(<AndroidDownloadButton />)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.body.style.overflow).toBe('')
})

it('cleans up a modal on unmount without changing the previous scroll style', () => {
  vi.useFakeTimers()
  const timers = vi.spyOn(window, 'setTimeout')
  const clearTimer = vi.spyOn(window, 'clearTimeout')
  document.body.style.overflow = 'auto'
  const { unmount } = render(<AndroidDownloadButton />)
  fireEvent.click(screen.getByRole('button', { name: 'Android app download QR code' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Android download' }))
  const exitTimerIndex = timers.mock.calls.findIndex(([, delay]) => delay === 260)
  expect(exitTimerIndex).toBeGreaterThanOrEqual(0)
  const exitTimer = timers.mock.results[exitTimerIndex].value
  unmount()
  expect(clearTimer).toHaveBeenCalledWith(exitTimer)
  expect(document.body.style.overflow).toBe('auto')
  document.body.style.overflow = ''
})
