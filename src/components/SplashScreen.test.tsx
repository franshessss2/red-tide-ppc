// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INTRO_EXIT_MS, INTRO_SCENE_MS, INTRO_TRANSITION_MS, SplashScreen } from './SplashScreen'
import { INTRO_SEEN_KEY } from './intro/introGate'
import { REEL_SCENES, REEL_CLOSING_SCENE } from './intro/reelScenes'
vi.mock('../pages/Landing', () => ({ Landing: ({ onReplay }: { onReplay: () => void }) => <main><h1>Red Tide</h1><button data-intro-replay aria-label="Watch introduction" onClick={onReplay}>↻</button><a className="landing-map-cta" href="/map">Open the map</a></main> }))
let reduced = false
let preferenceListeners: Set<() => void> = new Set()
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); window.history.replaceState({}, '', '/')
  reduced = false; preferenceListeners = new Set()
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced }, addEventListener: (_: string, fn: () => void) => { preferenceListeners.add(fn) }, removeEventListener: (_: string, fn: () => void) => { preferenceListeners.delete(fn) } }))
  window.scrollTo = vi.fn()
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const dialog = () => screen.queryByRole('dialog', { name: 'Introduction' })
const enter = () => screen.getByRole('button', { name: 'Explore Red Tide' })
function tick(ms: number) { act(() => vi.advanceTimersByTime(ms)) }

describe('reel-inspired intro', () => {
  it('crossfades overlapping chapters without remounting the incoming illustration', () => {
    render(<SplashScreen />)
    tick(INTRO_SCENE_MS)
    expect(dialog()?.getAttribute('data-scene')).toBe('0')
    expect(document.querySelector('.showroom-stage--out')).toBeTruthy()
    const incoming = document.querySelector('.showroom-stage--incoming')
    const mark = incoming?.querySelector('.reel-mark')
    expect(incoming?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByRole('heading', { name: 'RED TIDE' })).toBeNull()
    expect(screen.queryByText('Explore coastal zones.')).toBeNull()
    tick(INTRO_TRANSITION_MS - 1)
    expect(dialog()?.getAttribute('data-scene')).toBe('0')
    tick(1)
    expect(dialog()?.getAttribute('data-scene')).toBe('1')
    expect(document.querySelector('.showroom-stage--out')).toBeNull()
    expect(document.querySelector('.reel-mark')).toBe(mark)
    expect(document.querySelector('.showroom-stage--incoming')).toBeNull()
  })
  it('restores the closing title and loops through all nine scenes with their own reading time', () => {
    render(<SplashScreen />)
    for (let cycle = 0; cycle < 2; cycle++) {
      for (let previous = 0; previous < REEL_SCENES.length; previous++) {
        const scene = (previous + 1) % REEL_SCENES.length
        tick(REEL_SCENES[previous].duration); tick(INTRO_TRANSITION_MS)
        expect(dialog()?.getAttribute('data-scene')).toBe(String(scene))
        if (scene === 2) expect(document.querySelector('.reel-map')).toBeTruthy()
        if (scene === 3) expect(screen.getByText('Awaiting admin review')).toBeTruthy()
        if (scene === REEL_CLOSING_SCENE) {
          expect(screen.getByRole('heading', { name: 'RED TIDE' })).toBeTruthy()
          expect(document.querySelector('.reel-mark')).toBeTruthy()
        }
      }
    }
    expect(window.location.pathname).toBe('/')
  })
  it.each(REEL_SCENES.map((_, index) => index))('one click exits from scene %s and cancels pending changes', scene => {
    render(<SplashScreen />)
    for (let i = 0; i < scene; i++) { tick(REEL_SCENES[i].duration); tick(INTRO_TRANSITION_MS) }
    fireEvent.click(enter()); fireEvent.click(enter())
    expect(document.querySelector('.showroom-experience--leaving')).toBeTruthy()
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBe('seen')
    tick(INTRO_EXIT_MS)
    expect(dialog()).toBeNull()
    expect(document.querySelector('[inert]')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Open the map' }))
    tick(60000); expect(dialog()).toBeNull()
  })
  it.each(['Enter', ' ', 'Escape'])('supports %s without scrolling or double activation', key => {
    render(<SplashScreen />)
    expect(document.activeElement).toBe(enter())
    expect(fireEvent.keyDown(enter(), { key })).toBe(false)
    tick(INTRO_EXIT_MS); expect(dialog()).toBeNull()
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
  it('ignores repeated keys and traps focus on the one intro action', () => {
    render(<SplashScreen />)
    fireEvent.keyDown(enter(), { key: 'Enter', repeat: true })
    expect(document.querySelector('.showroom-experience--playing')).toBeTruthy()
    fireEvent.keyDown(enter(), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(enter())
  })
  it('shows static equivalent information under reduced motion and can exit', () => {
    reduced = true; render(<SplashScreen />)
    expect(screen.getByText(/Explore the coast. Share observations./)).toBeTruthy()
    expect(screen.getByText(/Reports are reviewed by an admin/)).toBeTruthy()
    tick(20000); expect(dialog()?.getAttribute('data-scene')).toBe('0')
    fireEvent.click(enter()); tick(120); expect(dialog()).toBeNull()
  })
  it('halts autoplay if reduced motion is enabled during playback', () => {
    render(<SplashScreen />); { tick(INTRO_SCENE_MS); tick(INTRO_TRANSITION_MS) }
    act(() => { reduced = true; preferenceListeners.forEach(fn => fn()) })
    tick(20000); expect(dialog()?.getAttribute('data-scene')).toBe('1')
    expect(screen.getByText(/Reports are reviewed by an admin/)).toBeTruthy()
  })
  it('replays from the header and restores focus there on exit', () => {
    localStorage.setItem(INTRO_SEEN_KEY, 'seen'); render(<SplashScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Watch introduction' }))
    expect(dialog()?.getAttribute('data-scene')).toBe('0')
    fireEvent.click(enter()); tick(INTRO_EXIT_MS)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Watch introduction' }))
  })
  it('fails open if storage cannot be read, and still exits if writes fail', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked') })
    render(<SplashScreen />); expect(dialog()).toBeNull(); cleanup(); read.mockRestore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked') })
    render(<SplashScreen />); fireEvent.click(enter()); tick(INTRO_EXIT_MS); expect(dialog()).toBeNull()
  })
  it('cleans up timers and scroll locking on unmount, including StrictMode', () => {
    const view = render(<StrictMode><SplashScreen /></StrictMode>)
    tick(INTRO_SCENE_MS); tick(INTRO_TRANSITION_MS); expect(dialog()?.getAttribute('data-scene')).toBe('1')
    view.unmount(); tick(60000); expect(document.body.style.overflow).toBe('')
  })
  it('pauses a fade while hidden and resumes its remaining duration', () => {
    let hidden = false
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    render(<SplashScreen />)
    tick(INTRO_SCENE_MS); tick(200)
    act(() => { hidden = true; document.dispatchEvent(new Event('visibilitychange')) })
    expect(document.querySelector('.showroom--paused')).toBeTruthy()
    tick(30000)
    expect(dialog()?.getAttribute('data-scene')).toBe('0')
    act(() => { hidden = false; document.dispatchEvent(new Event('visibilitychange')) })
    tick(INTRO_TRANSITION_MS - 201)
    expect(dialog()?.getAttribute('data-scene')).toBe('0')
    tick(1)
    expect(dialog()?.getAttribute('data-scene')).toBe('1')
  })
  it('cancels the outgoing fade when dismissed and replay starts cleanly', () => {
    render(<SplashScreen />)
    tick(INTRO_SCENE_MS)
    fireEvent.click(enter())
    tick(INTRO_EXIT_MS)
    expect(dialog()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Watch introduction' }))
    expect(dialog()?.getAttribute('data-scene')).toBe('0')
    expect(document.querySelector('.showroom-stage--out')).toBeNull()
  })
  it('pauses scene time while the tab is hidden', () => {
    let hidden = false
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    render(<SplashScreen />); tick(1000)
    act(() => { hidden = true; document.dispatchEvent(new Event('visibilitychange')) })
    tick(30000); expect(dialog()?.getAttribute('data-scene')).toBe('0')
    act(() => { hidden = false; document.dispatchEvent(new Event('visibilitychange')) })
    tick(INTRO_SCENE_MS); tick(INTRO_TRANSITION_MS); expect(dialog()?.getAttribute('data-scene')).toBe('1')
  })
})
