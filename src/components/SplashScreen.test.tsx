// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  INTRO_ENTRANCE_MS,
  INTRO_EXIT_MS,
  INTRO_SCENE_COUNT,
  INTRO_TITLE_HANDOFF_DELAY_MS,
  INTRO_TITLE_HANDOFF_MS,
  SplashScreen,
} from './SplashScreen'
import { INTRO_SEEN_KEY } from './intro/introGate'
import { INTRO_SCENE_COPY } from './intro/IntroScenes'

vi.mock('../pages/Landing', () => ({ Landing: () => <main><h1 aria-label="Red Tide">RED TIDE</h1><a className="landing-map-cta" href="/map">Open the map</a></main> }))
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
let reduced = false
let listener: (() => void) | undefined

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  reduced = false
  listener = undefined
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reduced },
    addEventListener: (_: string, fn: () => void) => { listener = fn },
    removeEventListener: vi.fn(),
  }))
  window.scrollTo = vi.fn()
})

afterEach(() => {
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
  else Reflect.deleteProperty(document, 'fonts')
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const intro = () => screen.queryByRole('dialog', { name: 'Introduction' })
const advanceButton = () => screen.getByRole('button', { name: /TAP TO BEGIN|TAP TO ENTER|Step \d of \d/ })
const skipButton = () => screen.getByRole('button', { name: 'Skip introduction' })
const sceneOf = (overlay: HTMLElement) => overlay.getAttribute('data-scene')

function splash() {
  render(<SplashScreen />)
  return screen.getByRole('dialog', { name: 'Introduction' })
}

function enterIdle() {
  const overlay = splash()
  act(() => vi.advanceTimersByTime(INTRO_ENTRANCE_MS))
  expect(document.querySelector('.tide-experience--idle')).toBeTruthy()
  expect(document.querySelector('[data-hint-state="visible"]')).toBeTruthy()
  return overlay
}

function triggerExitByEscape() {
  const overlay = screen.getByRole('dialog', { name: 'Introduction' })
  fireEvent.keyDown(overlay, { key: 'Escape' })
  return overlay
}

describe('cinematic entrance (scene 0)', () => {
  it('does not auto-exit after 30s without input', () => {
    const overlay = splash()
    act(() => vi.advanceTimersByTime(30000))
    expect(document.querySelector('.tide-intro')).toBeTruthy()
    expect(document.querySelector('.tide-experience--idle')).toBeTruthy()
    expect(overlay).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Introduction' })).toBe(overlay)
    // No timer ever changes the scene either.
    expect(sceneOf(overlay)).toBe('0')
  })

  it('Skip exits immediately and completes the existing 800ms exit', () => {
    splash()
    fireEvent.click(skipButton())
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(intro()).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })

  it('a click on the tap surface advances to scene 1 instead of exiting', () => {
    const overlay = splash()
    fireEvent.click(advanceButton())
    expect(document.querySelector('.tide-experience--leaving')).toBeNull()
    expect(sceneOf(overlay)).toBe('1')
    expect(screen.getByText('Red tide.')).toBeTruthy()
  })

  it('Enter and Space advance one scene; Escape dismisses', () => {
    for (const key of ['Enter', ' ']) {
      localStorage.clear()
      const overlay = splash()
      fireEvent.keyDown(advanceButton(), { key })
      expect(sceneOf(overlay)).toBe('1')
      expect(document.querySelector('.tide-experience--leaving')).toBeNull()
      cleanup()
    }
    localStorage.clear()
    splash()
    fireEvent.keyDown(advanceButton(), { key: 'Escape' })
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
  })

  it('Space advances without scrolling the page', () => {
    const overlay = splash()
    const event = fireEvent.keyDown(advanceButton(), { key: ' ' })
    expect(event).toBe(false) // defaultPrevented: the browser never scrolls or double-clicks
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(sceneOf(overlay)).toBe('1')
  })

  it('double trigger on the final scene starts the exit only once', () => {
    const { unmount } = render(<SplashScreen />)
    const title = document.querySelector<HTMLElement>('.tide-intro__title')!
    vi.spyOn(title, 'getBoundingClientRect').mockReturnValue({
      x: 100, y: 100, left: 100, top: 100, right: 700, bottom: 280, width: 600, height: 180, toJSON: () => ({})
    })
    const heading = document.querySelector('h1')!
    vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue({
      x: 20, y: 20, left: 20, top: 20, right: 260, bottom: 92, width: 240, height: 72, toJSON: () => ({})
    })
    const cancel = vi.fn()
    const animate = vi.fn(() => ({ cancel }))
    title.animate = animate as unknown as typeof title.animate
    for (let i = 0; i < INTRO_SCENE_COUNT; i++) fireEvent.click(advanceButton())
    fireEvent.click(advanceButton())
    fireEvent.click(screen.getByRole('button', { name: 'TAP TO ENTER' }))
    expect(animate).toHaveBeenCalledOnce()
    unmount()
  })

  it('preserves the Escape path and marks the device seen', () => {
    splash()
    triggerExitByEscape()
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(intro()).toBeNull()
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBe('seen')
    cleanup()
    render(<SplashScreen />)
    expect(intro()).toBeNull()
  })

  it('bypasses the entrance entirely under reduced motion', () => {
    reduced = true
    const { container } = render(<SplashScreen />)
    expect(intro()).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Intro motion off' }).hasAttribute('disabled')).toBe(true)
  })

  it('immediately releases the page if motion preference changes during the intro', () => {
    const { container } = render(<SplashScreen />)
    act(() => { reduced = true; listener?.() })
    expect(intro()).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
  })

  it('keeps localStorage red-tide-ppc:intro:v2 from replaying', () => {
    localStorage.setItem('red-tide-ppc:intro:v2', 'seen')
    const { container } = render(<SplashScreen />)
    expect(intro()).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
  })

  it('fails open to the content when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { container } = render(<SplashScreen />)
    expect(intro()).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
  })

  it('still dismisses when only the storage write is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    splash()
    triggerExitByEscape()
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(intro()).toBeNull()
  })

  it('cleans up the body scroll lock when unmounted during the entrance', () => {
    document.body.style.overflow = ''
    const { unmount } = render(<SplashScreen />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('exposes a modal dialog with a focused advance control and Skip next in order', () => {
    const overlay = splash()
    expect(overlay.getAttribute('role')).toBe('dialog')
    expect(overlay.getAttribute('aria-modal')).toBe('true')
    expect(overlay.getAttribute('aria-label')).toBe('Introduction')
    const advance = advanceButton()
    expect(advance.getAttribute('aria-label')).toBe('TAP TO BEGIN')
    expect(document.activeElement).toBe(advance)
    const skip = skipButton()
    expect(skip.textContent).toBe('Skip')
    // Tab order: the advance surface first, Skip immediately after.
    const focusables = [...overlay.querySelectorAll('button')]
    expect(focusables.indexOf(advance as HTMLButtonElement)).toBeLessThan(focusables.indexOf(skip as HTMLButtonElement))
  })

  it('shows the TAP TO BEGIN hint after entrance and changes it to exiting on skip', () => {
    enterIdle()
    const hint = document.querySelector('[data-hint-state="visible"]')
    expect(hint?.textContent).toBe('TAP TO BEGIN')
    fireEvent.click(skipButton())
    expect(document.querySelector('[data-hint-state="exiting"]')).toBeTruthy()
  })

  it('wraps Tab and Shift+Tab inside the introduction, including attribution', () => {
    const overlay = splash()
    const advance = advanceButton()
    const credit = overlay.querySelector<HTMLAnchorElement>('a[href]')!
    fireEvent.keyDown(advance, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(credit)
    fireEvent.keyDown(credit, { key: 'Tab' })
    expect(document.activeElement).toBe(advance)
    skipButton().focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    skipButton().dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('tap-to-advance scenes', () => {
  it('advances one scene per input for click, Enter, Space and ArrowRight', () => {
    const overlay = splash()
    fireEvent.click(advanceButton())
    expect(sceneOf(overlay)).toBe('1')
    fireEvent.keyDown(advanceButton(), { key: 'Enter' })
    expect(sceneOf(overlay)).toBe('2')
    fireEvent.keyDown(advanceButton(), { key: ' ' })
    expect(sceneOf(overlay)).toBe('3')
    fireEvent.keyDown(advanceButton(), { key: 'ArrowRight' })
    expect(sceneOf(overlay)).toBe('4')
  })

  it('increments exactly once per tap, including rapid taps mid-transition', () => {
    const overlay = splash()
    fireEvent.click(advanceButton())
    fireEvent.click(advanceButton())
    fireEvent.click(advanceButton())
    expect(sceneOf(overlay)).toBe('3')
    // The interrupted ghost completes (drops) rather than double-advancing.
    expect(document.querySelectorAll('.tide-scene--in')).toHaveLength(1)
  })

  it('does not race through scenes when an advance key is held down', () => {
    const overlay = splash()
    for (const key of ['Enter', ' ', 'ArrowRight']) {
      fireEvent.keyDown(advanceButton(), { key, repeat: true })
    }
    expect(sceneOf(overlay)).toBe('0')
    fireEvent.keyDown(advanceButton(), { key: 'Enter' })
    expect(sceneOf(overlay)).toBe('1')
  })

  it('retains the actual outgoing panel through exit instead of recreating it', () => {
    splash()
    fireEvent.click(advanceButton())
    const first = document.querySelector('[data-scene-panel="1"]')
    fireEvent.click(advanceButton())
    expect(document.querySelector('[data-scene-panel="1"]')).toBe(first)
    expect(first?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(advanceButton())
    expect(document.querySelectorAll('.tide-scene--out')).toHaveLength(1)
  })

  it('keeps one handset and selected zone mounted across the product screens', () => {
    splash()
    for (let i = 0; i < 3; i++) fireEvent.click(advanceButton())
    const phone = document.querySelector('.intro-phone--persistent')
    const selected = phone?.querySelector('.intro-phone__selected-zone')
    fireEvent.click(advanceButton())
    expect(document.querySelector('.intro-phone--report')).toBe(phone)
    expect(phone?.querySelector('.intro-phone__selected-zone')).toBe(selected)
    expect(document.querySelectorAll('.intro-phone')).toHaveLength(1)
    fireEvent.click(advanceButton())
    expect(document.querySelector('.intro-phone--persistent')).toBe(phone)
  })

  it('never auto-advances: a scene holds for 30s until the next tap', () => {
    const overlay = splash()
    fireEvent.click(advanceButton())
    act(() => vi.advanceTimersByTime(30000))
    expect(sceneOf(overlay)).toBe('1')
    expect(document.querySelector('.tide-experience--leaving')).toBeNull()
  })

  it('a full run is six taps and ends in the existing PR57 exit', () => {
    const overlay = splash()
    for (let i = 1; i <= INTRO_SCENE_COUNT; i++) {
      fireEvent.click(advanceButton())
      expect(sceneOf(overlay)).toBe(String(i))
      expect(document.querySelector('.tide-experience--leaving')).toBeNull()
    }
    expect(screen.getByRole('button', { name: 'TAP TO ENTER' })).toBeTruthy()
    fireEvent.click(advanceButton()) // sixth tap
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(intro()).toBeNull()
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBe('seen')
  })

  it('renders the fixed copy of every scene exactly', () => {
    splash()
    fireEvent.click(advanceButton())
    const kicker = screen.getByText('Pula ang dagat.')
    expect(kicker.getAttribute('lang')).toBe('fil')
    expect(screen.getByText('Red tide.')).toBeTruthy()

    fireEvent.click(advanceButton())
    for (const line of INTRO_SCENE_COPY[2]) expect(screen.getByText(line)).toBeTruthy()

    fireEvent.click(advanceButton())
    act(() => vi.advanceTimersByTime(1000)) // retire the scene-2 ghost
    expect(screen.getByText('See every zone.')).toBeTruthy()
    expect(document.querySelector('.intro-phone--zones')).toBeTruthy()

    fireEvent.click(advanceButton())
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText('Report what you see.')).toBeTruthy()
    expect(screen.getByText('Reviewed before an advisory is raised.')).toBeTruthy()
    expect(document.querySelector('.intro-phone--report')).toBeTruthy()

    fireEvent.click(advanceButton())
    act(() => vi.advanceTimersByTime(1000))
    // "One coast. A shared watch." also exists in the PR57 scene-0 copy block,
    // so the final frame is asserted inside its own scene panel.
    const final = document.querySelector<HTMLElement>('[data-scene-panel="5"]')!
    expect(within(final).getByText('One coast. A shared watch.')).toBeTruthy()
    expect(within(final).getByText('Community reports. Not a substitute for a BFAR advisory.')).toBeTruthy()
  })

  it('announces the current scene politely for screen readers', () => {
    const overlay = splash()
    const live = overlay.querySelector('[aria-live="polite"]')!
    expect(live.textContent).toBe('')
    fireEvent.click(advanceButton())
    expect(live.textContent).toBe('Step 1 of 5. Pula ang dagat. Red tide.')
    fireEvent.click(advanceButton())
    expect(live.textContent).toBe(
      'Step 2 of 5. The sea can look normal. The shellfish can still make you sick. Cooking does not make it safe.',
    )
  })

  it('keeps Skip reachable on every scene and exits from mid-story', () => {
    splash()
    expect(skipButton()).toBeTruthy()
    for (let i = 1; i <= INTRO_SCENE_COUNT; i++) {
      fireEvent.click(advanceButton())
      expect(skipButton()).toBeTruthy()
    }
    cleanup()
    localStorage.clear()
    splash()
    fireEvent.click(advanceButton())
    fireEvent.click(advanceButton())
    fireEvent.click(skipButton())
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(intro()).toBeNull()
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBe('seen')
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(document.querySelector('.landing-map-cta'))
  })

  it('Escape skips from a mid-story scene and restores focus and scroll lock', () => {
    splash()
    fireEvent.click(advanceButton())
    fireEvent.keyDown(advanceButton(), { key: 'Escape' })
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(intro()).toBeNull()
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBe('seen')
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(document.querySelector('.landing-map-cta'))
  })

  it('does not render the intro on a pathname other than "/"', () => {
    window.history.replaceState({}, '', '/map')
    const { container } = render(<SplashScreen />)
    expect(intro()).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
  })

  it('forces one replay via ?intro=1 without clearing storage', () => {
    localStorage.setItem(INTRO_SEEN_KEY, 'seen')
    window.history.replaceState({}, '', '/?intro=1')
    splash()
    expect(intro()).toBeTruthy()
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBe('seen')
  })

  it('unmount leaves no timers, listeners or requestAnimationFrame loops behind', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    const added = vi.spyOn(document, 'addEventListener')
    const removed = vi.spyOn(document, 'removeEventListener')
    const { unmount } = render(<SplashScreen />)
    fireEvent.click(advanceButton())
    fireEvent.click(advanceButton())
    unmount()
    // jsdom's own focus() schedules a 0ms selection timer; everything the
    // component scheduled must be gone, so draining once reaches zero with
    // nothing re-arming.
    act(() => vi.runAllTimers())
    expect(vi.getTimerCount()).toBe(0)
    expect(raf).not.toHaveBeenCalled()
    const addedVisibility = added.mock.calls.filter(([type]) => type === 'visibilitychange').length
    const removedVisibility = removed.mock.calls.filter(([type]) => type === 'visibilitychange').length
    expect(addedVisibility).toBeGreaterThan(0)
    expect(removedVisibility).toBe(addedVisibility)
    expect(document.body.style.overflow).toBe('')
  })
})

function measuredIntro() {
  const view = render(<SplashScreen />)
  const title = document.querySelector<HTMLElement>('.tide-intro__title')!
  const heading = view.container.querySelector('h1')!
  const rect = (x: number, y: number, width: number, height: number) =>
    ({ x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({}) })
  vi.spyOn(title, 'getBoundingClientRect').mockReturnValue(rect(300, 200, 600, 180))
  vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue(rect(40, 120, 240, 72))
  const cancel = vi.fn()
  const animate = vi.fn(() => ({ cancel }))
  title.animate = animate as unknown as typeof title.animate
  return { ...view, title, heading, animate, cancel }
}

describe('First Ripple handoff', () => {
  it('starts the title handoff before the synchronized surface reveal completes', () => {
    expect(INTRO_TITLE_HANDOFF_DELAY_MS).toBeGreaterThanOrEqual(0)
    expect(INTRO_TITLE_HANDOFF_DELAY_MS + INTRO_TITLE_HANDOFF_MS).toBeLessThan(INTRO_EXIT_MS)
  })

  it('measures the wordmark and restores the underlying heading after Escape', () => {
    const { heading, animate, cancel } = measuredIntro()
    triggerExitByEscape()
    expect(document.querySelector('[data-handoff="measured"]')).toBeTruthy()
    expect(animate.mock.calls[0]).toEqual([
      [{ transform: 'translate(0, 0) scale(1, 1)' }, { transform: 'translate(-260px, -80px) scale(0.4, 0.4)' }],
      expect.objectContaining({
        duration: INTRO_TITLE_HANDOFF_MS,
        delay: INTRO_TITLE_HANDOFF_DELAY_MS,
      }),
    ])
    expect(INTRO_TITLE_HANDOFF_MS + INTRO_TITLE_HANDOFF_DELAY_MS).toBeLessThan(INTRO_EXIT_MS)
    expect(heading.style.visibility).toBe('hidden')
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(intro()).toBeNull()
    expect(heading.style.visibility).toBe('')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('runs the measured handoff from the final scene, where the wordmark is visible again', () => {
    const { animate } = measuredIntro()
    for (let i = 0; i < INTRO_SCENE_COUNT; i++) fireEvent.click(advanceButton())
    fireEvent.click(advanceButton())
    expect(document.querySelector('[data-handoff="measured"]')).toBeTruthy()
    expect(animate).toHaveBeenCalledOnce()
  })

  it('skips the measured handoff from mid-story scenes, where the wordmark is hidden', () => {
    const { animate, heading } = measuredIntro()
    fireEvent.click(advanceButton())
    fireEvent.click(advanceButton())
    fireEvent.click(skipButton())
    expect(animate).not.toHaveBeenCalled()
    expect(heading.style.visibility).toBe('')
    expect(document.querySelector('[data-handoff="fade"]')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(intro()).toBeNull()
  })

  it('restores the heading on resize during the handoff', () => {
    const { heading, cancel } = measuredIntro()
    triggerExitByEscape()
    fireEvent(window, new Event('resize'))
    expect(cancel).toHaveBeenCalled()
    expect(heading.style.visibility).toBe('')
    expect(document.querySelector('[data-handoff="fade"]')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(intro()).toBeNull()
  })

  it('makes the beginning hint available before the entrance completes', () => {
    splash()
    expect(document.querySelector('[data-hint-state="visible"]')?.textContent?.trim()).toBe('TAP TO BEGIN')
    fireEvent.click(skipButton())
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
  })

  it('uses an on-time dissolve when fonts are still loading', () => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: { status: 'loading' } })
    const { heading, animate } = measuredIntro()
    triggerExitByEscape()
    expect(animate).not.toHaveBeenCalled()
    expect(heading.style.visibility).toBe('')
    expect(document.querySelector('[data-handoff="fade"]')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(intro()).toBeNull()
  })

  it('does not hide the landing heading if the animation API throws', () => {
    const { heading, animate } = measuredIntro()
    animate.mockImplementation(() => { throw new Error('unsupported') })
    triggerExitByEscape()
    expect(document.querySelector('[data-handoff="fade"]')).toBeTruthy()
    expect(heading.style.visibility).toBe('')
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(intro()).toBeNull()
  })

  it('cancels the measured handoff when reduced motion changes live', () => {
    const { heading, cancel } = measuredIntro()
    triggerExitByEscape()
    act(() => { reduced = true; listener?.() })
    expect(intro()).toBeNull()
    expect(heading.style.visibility).toBe('')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('pauses loops on visibilitychange and resumes them when visible', () => {
    const overlay = splash()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange'))
    expect(overlay.classList.contains('tide-intro--hidden')).toBe(true)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    fireEvent(document, new Event('visibilitychange'))
    expect(overlay.classList.contains('tide-intro--hidden')).toBe(false)
  })

  it('keeps repeated replay and Escape independent under StrictMode', () => {
    render(<StrictMode><SplashScreen /></StrictMode>)
    for (let i = 0; i < 3; i++) {
      const overlay = screen.getByRole('dialog', { name: 'Introduction' })
      fireEvent.keyDown(overlay, { key: 'Escape' })
      act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
      fireEvent.click(screen.getByRole('button', { name: 'Replay intro' }))
      expect(screen.getAllByRole('dialog', { name: 'Introduction' })).toHaveLength(1)
      // Replay restarts from scene 0 at the entrance.
      expect(sceneOf(screen.getByRole('dialog', { name: 'Introduction' }))).toBe('0')
    }
    const overlay = screen.getByRole('dialog', { name: 'Introduction' })
    fireEvent.keyDown(overlay, { key: 'Escape' })
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(intro()).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Replay intro' }))
  })

  it('cancels and restores the title when unmounted during the handoff', () => {
    const { unmount, heading, cancel } = measuredIntro()
    triggerExitByEscape()
    unmount()
    expect(cancel).toHaveBeenCalledOnce()
    expect(heading.style.visibility).toBe('')
  })
})
