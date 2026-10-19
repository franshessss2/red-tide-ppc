// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CoastalSteps } from './CoastalSteps'
import { LandingMotionPolicy } from '../motion/LandingMotionPolicy'

const preference = vi.hoisted(() => ({ reduced: false }))
vi.mock('../motion/preferences', async importOriginal => ({
  ...await importOriginal<typeof import('../motion/preferences')>(),
  useReducedMotion: () => preference.reduced,
}))
beforeEach(() => Object.defineProperty(document, 'hidden', { configurable: true, value: false }))
afterEach(() => { cleanup(); preference.reduced = false; Reflect.deleteProperty(document, 'hidden'); vi.unstubAllGlobals() })

it.each(['reduced motion', 'Save-Data'])('keeps the illustrations static under %s without starting observers', policy => {
  const observer = vi.fn()
  vi.stubGlobal('IntersectionObserver', observer)
  preference.reduced = policy === 'reduced motion'
  render(<LandingMotionPolicy.Provider value={policy === 'Save-Data'}><CoastalSteps /></LandingMotionPolicy.Provider>)
  expect(observer).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Community review' })).toBeTruthy()
  expect(screen.getByText(/Check BFAR for official bulletins/)).toBeTruthy()
})

it('runs visible artwork only, pauses for a hidden tab or offscreen card, and disconnects observers', () => {
  const watchers: { callback: IntersectionObserverCallback; target?: Element; disconnect: ReturnType<typeof vi.fn<() => void>> }[] = []
  vi.stubGlobal('IntersectionObserver', class {
    watcher: typeof watchers[number]
    constructor(callback: IntersectionObserverCallback) {
      this.watcher = { callback, disconnect: vi.fn() }
      watchers.push(this.watcher)
    }
    observe(target: Element) { this.watcher.target = target }
    unobserve() {}
    disconnect() { this.watcher.disconnect() }
  })
  const view = render(<CoastalSteps />)
  const arts = Array.from(view.container.querySelectorAll('.coastal-step__art'))
  const artworkWatchers = watchers.filter(watcher => arts.includes(watcher.target!))
  expect(artworkWatchers).toHaveLength(3)
  expect(arts.every(art => art.getAttribute('data-running') === 'false')).toBe(true)
  const intersect = (index: number, isIntersecting: boolean) => act(() => {
    const watcher = artworkWatchers[index]
    watcher.callback([{ isIntersecting, target: watcher.target } as IntersectionObserverEntry], {} as IntersectionObserver)
  })
  intersect(0, true)
  expect(arts.map(art => art.getAttribute('data-running'))).toEqual(['true', 'false', 'false'])
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(arts[0].getAttribute('data-running')).toBe('false')
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(arts[0].getAttribute('data-running')).toBe('true')
  intersect(0, false)
  expect(arts[0].getAttribute('data-running')).toBe('false')
  view.unmount()
  expect(artworkWatchers.every(watcher => watcher.disconnect.mock.calls.length === 1)).toBe(true)
})

it('falls back to static illustrations if IntersectionObserver is unavailable', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const { container } = render(<CoastalSteps />)
  expect(container.querySelector('.coastal-steps')?.getAttribute('data-motion')).toBe('static')
  expect(screen.getByRole('heading', { name: 'Find your shore' })).toBeTruthy()
})
