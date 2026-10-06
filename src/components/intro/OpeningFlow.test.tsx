// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SplashScreen, INTRO_EXIT_MS, INTRO_SCENE_MS } from '../SplashScreen'
import { OPENING_FADE_MS } from './OpeningFilm'
import { INTRO_SEEN_KEY } from './introGate'
vi.mock('../../pages/Landing', () => ({ Landing: ({ onReplay }: { onReplay: () => void }) => <main><button data-intro-replay onClick={onReplay}>Watch introduction</button><a className="landing-map-cta" href="/map">Open the map</a></main> }))
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); window.history.replaceState({}, '', '/')
  vi.stubGlobal('matchMedia', () => ({ matches:false, addEventListener:vi.fn(), removeEventListener:vi.fn() }))
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  window.scrollTo = vi.fn()
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms))
it('does not consume chapter timing under the film; proceeds, exits, and replay omits the film', () => {
  render(<SplashScreen />)
  expect(screen.queryByRole('button', { name:'Explore Red Tide' })).toBeNull()
  tick(INTRO_SCENE_MS)
  expect(document.querySelector('.showroom-stage--out')).toBeNull()
  fireEvent.ended(document.querySelector('video')!); tick(OPENING_FADE_MS)
  expect(document.querySelector('video')).toBeNull()
  const enter = screen.getByRole('button', { name:'Explore Red Tide' })
  expect(document.activeElement).toBe(enter)
  expect(document.querySelector('[role=dialog]')!.getAttribute('data-scene')).toBe('0')
  expect(localStorage.getItem(INTRO_SEEN_KEY)).toBeNull()
  fireEvent.click(enter); tick(INTRO_EXIT_MS)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('link', { name:'Open the map' }))
  fireEvent.click(screen.getByRole('button', { name:'Watch introduction' }))
  expect(document.querySelector('video')).toBeNull()
  expect(screen.getByRole('button', { name:'Explore Red Tide' })).toBeTruthy()
})
it('does not load media under reduced motion or when the intro is already seen', () => {
  localStorage.setItem(INTRO_SEEN_KEY, 'seen'); render(<SplashScreen />)
  expect(document.querySelector('video')).toBeNull(); cleanup(); localStorage.clear()
  vi.stubGlobal('matchMedia', () => ({ matches:true, addEventListener:vi.fn(), removeEventListener:vi.fn() }))
  render(<SplashScreen />); expect(document.querySelector('video')).toBeNull()
  expect(screen.getByRole('button', { name:'Explore Red Tide' })).toBeTruthy()
})
