// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INTRO_EXIT_MS, INTRO_HOLD_MS, SplashScreen } from './SplashScreen'

vi.mock('../pages/Landing', () => ({ Landing: () => <main><h1 aria-label="Red Tide">RED TIDE</h1><a className="landing-map-cta" href="/map">Open the map</a></main> }))
let reduced = false
let listener: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  reduced = false
  listener = undefined
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced }, addEventListener: (_: string, fn: () => void) => { listener = fn }, removeEventListener: vi.fn() }))
  window.scrollTo = vi.fn()
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('cinematic entrance', () => {
  it('finishes on time without waiting for data and restores focus and scrolling', () => {
    document.body.style.overflow = 'auto'
    const { container } = render(<SplashScreen />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Skip intro/ }))
    expect(container.querySelector('[inert]')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_HOLD_MS))
    expect(document.querySelector('.tide-intro--leaving')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Open the map' }))
    expect(document.body.style.overflow).toBe('auto')
  })
  it('skip is immediate, cancels pending timers, and marks the session seen', () => {
    render(<SplashScreen />)
    fireEvent.click(screen.getByRole('button', { name: /Skip intro/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    render(<SplashScreen />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('supports Escape and replay, with focus returned to replay afterward', () => {
    render(<SplashScreen />)
    fireEvent.keyDown(window, { key: 'Escape' })
    const replay = screen.getByRole('button', { name: 'Replay intro' })
    fireEvent.click(replay)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(replay)
  })
  it('bypasses the entrance entirely under reduced motion', () => {
    reduced = true
    const { container } = render(<SplashScreen />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Intro motion off' }).hasAttribute('disabled')).toBe(true)
  })
  it('immediately releases the page if motion preference changes during the intro', () => {
    const { container } = render(<SplashScreen />)
    act(() => { reduced = true; listener?.() })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
  })
  it('still completes when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(<SplashScreen />)
    fireEvent.click(screen.getByRole('button', { name: /Skip intro/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('cleans up the body scroll lock when unmounted during playback', () => {
    document.body.style.overflow = ''
    const scheduled = vi.spyOn(window, 'setTimeout')
    const cancelled = vi.spyOn(window, 'clearTimeout')
    const { unmount } = render(<SplashScreen />)
    const introCall = scheduled.mock.calls.findIndex(call => call[1] === INTRO_HOLD_MS)
    const introTimer = scheduled.mock.results[introCall].value
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
    expect(cancelled).toHaveBeenCalledWith(introTimer)
  })
})
