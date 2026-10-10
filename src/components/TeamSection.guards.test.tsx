// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TEAM_MEMBERS } from '../data/team'
import { TeamSection } from './TeamSection'

// These fake paths are test inputs only; the real roster import above is empty.
const fixture = [{ ...TEAM_MEMBERS[0], name: 'Test Member A', role: 'Test Role A',
  initials: 'TA', posterSrc: '/test-only/team/guard.jpg', videoSrc: '/test-only/team/guard.mp4' }]
let intersect: IntersectionObserverCallback
let disconnect: ReturnType<typeof vi.fn>
let hidden = false
let network: EventTarget & { saveData: boolean; effectiveType: string }

beforeEach(() => {
  hidden = false
  network = Object.assign(new EventTarget(), { saveData: false, effectiveType: '4g' })
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  Object.defineProperty(navigator, 'connection', { configurable: true, value: network })
  disconnect = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback }
    observe() {}
    disconnect = disconnect
  })
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  delete (navigator as Navigator & { connection?: unknown }).connection
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function visible() {
  act(() => intersect([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], {} as IntersectionObserver))
}

it('renders three real empty slots without media, empty headings or console errors when forced on', () => {
  const errors = vi.spyOn(console, 'error')
  const { container } = render(<TeamSection enabled />)
  expect(container.querySelectorAll('li')).toHaveLength(3)
  expect(container.querySelectorAll('h3,img,video')).toHaveLength(0)
  expect(container.querySelectorAll('.team-card__role')).toHaveLength(0)
  expect(container.querySelectorAll('.team-card__poster')[0].textContent).toBe('')
  expect(errors).not.toHaveBeenCalled()
})
it.each(['saveData', 'slow-2g', '2g'])('mounts no video for %s', (mode) => {
  network.saveData = mode === 'saveData'
  network.effectiveType = mode === 'saveData' ? '4g' : mode
  const { container } = render(<TeamSection enabled members={fixture} />)
  visible()
  expect(container.querySelector('video')).toBeNull()
  expect(container.querySelector('img')).not.toBeNull()
})
it('drops the mounted decoder when data-saving is enabled and cleans connection listeners up', () => {
  const remove = vi.spyOn(network, 'removeEventListener')
  const { container, unmount } = render(<TeamSection enabled members={fixture} />)
  visible()
  expect(container.querySelector('video')).not.toBeNull()
  act(() => { network.saveData = true; network.dispatchEvent(new Event('change')) })
  expect(container.querySelector('video')).toBeNull()
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  unmount()
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function))
})
it('pauses and drops media while hidden, then cleans observers and visibility listeners on unmount', () => {
  const remove = vi.spyOn(document, 'removeEventListener')
  const { container, unmount } = render(<TeamSection enabled members={fixture} />)
  visible()
  const video = container.querySelector('video')!
  act(() => { hidden = true; document.dispatchEvent(new Event('visibilitychange')) })
  expect(container.querySelector('video')).toBeNull()
  expect(video.hasAttribute('src')).toBe(false)
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  unmount()
  expect(disconnect).toHaveBeenCalled()
  expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
})
it('keeps flag-off rollback empty with populated test inputs too', () => {
  const { container } = render(<TeamSection enabled={false} members={fixture} />)
  expect(container.innerHTML).toBe('')
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
})
