// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { OpeningFilm, OPENING_FADE_MS } from './OpeningFilm'
let play: ReturnType<typeof vi.spyOn>
let pause: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  vi.useFakeTimers()
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms))
it('plays the local film, then fades once on end without navigating', () => {
  const done = vi.fn(); render(<OpeningFilm onComplete={done} />)
  const video = document.querySelector('video')!
  expect(video.getAttribute('src')).toBe('/media/opening-peak.mp4')
  expect(video.hasAttribute('playsinline')).toBe(true)
  expect(play).toHaveBeenCalledTimes(1)
  fireEvent.ended(video); fireEvent.ended(video)
  expect(pause).toHaveBeenCalled()
  tick(OPENING_FADE_MS - 1); expect(done).not.toHaveBeenCalled()
  tick(1); expect(done).toHaveBeenCalledTimes(1)
})
it('falls back to muted autoplay when sound is blocked without showing controls', async () => {
  play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
  render(<OpeningFilm onComplete={vi.fn()} />)
  await act(async () => {})
  expect(document.querySelector('video')!.muted).toBe(true)
  expect(screen.queryByRole('button')).toBeNull()
})
it('selects the lighter film on phones without switching mid-playback', () => {
  const media = vi.fn().mockReturnValue({ matches: true })
  vi.stubGlobal('matchMedia', media)
  const view = render(<OpeningFilm onComplete={vi.fn()} />)
  expect(document.querySelector('video')!.getAttribute('src')).toBe('/media/opening-peak-mobile.mp4')
  media.mockReturnValue({ matches: false } as MediaQueryList)
  view.rerender(<OpeningFilm onComplete={vi.fn()} />)
  expect(document.querySelector('video')!.getAttribute('src')).toBe('/media/opening-peak-mobile.mp4')
})
it('bounds failed loading and decoder errors', () => {
  const done = vi.fn(); render(<OpeningFilm onComplete={done} />)
  tick(8000); tick(OPENING_FADE_MS); expect(done).toHaveBeenCalledTimes(1)
  cleanup(); done.mockClear(); render(<OpeningFilm onComplete={done} />)
  fireEvent.error(document.querySelector('video')!); tick(OPENING_FADE_MS)
  expect(done).toHaveBeenCalledTimes(1)
})
it('pauses while hidden, resumes, and cancels watchdogs on unmount in StrictMode', () => {
  let hidden = false; vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  const done = vi.fn(); const view = render(<StrictMode><OpeningFilm onComplete={done} /></StrictMode>)
  hidden = true; fireEvent(document, new Event('visibilitychange'))
  tick(20000); expect(done).not.toHaveBeenCalled(); expect(pause).toHaveBeenCalled()
  hidden = false; fireEvent(document, new Event('visibilitychange'))
  view.unmount(); tick(20000); expect(done).not.toHaveBeenCalled()
})
it('contains keyboard focus and Escape proceeds into the intro', () => {
  const done = vi.fn(); render(<OpeningFilm onComplete={done} />)
  const film = document.querySelector('.opening-film')!
  expect(document.activeElement).toBe(film)
  fireEvent.keyDown(film, { key:'Tab' }); expect(document.activeElement).toBe(film)
  fireEvent.keyDown(document.activeElement!, { key:'Escape' }); tick(OPENING_FADE_MS)
  expect(done).toHaveBeenCalledTimes(1)
})

it('continues if audible and muted autoplay are both denied', async () => {
  play.mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
  const done = vi.fn(); render(<OpeningFilm onComplete={done} />)
  await act(async () => {})
  tick(OPENING_FADE_MS); expect(done).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button')).toBeNull()
})
