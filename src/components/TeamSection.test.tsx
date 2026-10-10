// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEAM_MEMBERS, TEAM_SECTION_ENABLED } from '../data/team'
import {
  TEAM_VIDEO_CROSSFADE_MS,
  TEAM_VIDEO_STALL_MS,
  TeamSection,
} from './TeamSection'

/**
 * The three media rules for the landing team strip, asserted as behaviour:
 *
 *  1. no `<video>` in the DOM until its card is ~50% in view,
 *  2. at most one `<video>` mounted — i.e. decoding — at any moment,
 *  3. the clip unmounts once its closing crossfade has finished.
 *
 * The policy tests render with `enabled` set so they exercise the strip; the
 * shipped default (`TEAM_SECTION_ENABLED`) is off while the roster holds
 * placeholders, which has its own test below.
 *
 * jsdom has no media pipeline, so `play` is stubbed and the first frame is
 * delivered by hand with a `loadeddata` event. The fake observer only reports
 * the elements it was actually asked to watch, so making one card visible
 * cannot accidentally report another one as visible too.
 */

type Entry = { target: Element; isIntersecting: boolean; intersectionRatio: number }

let observers: { cb: (entries: Entry[]) => void; targets: Set<Element> }[] = []
let reducedMotion = false

function installObserver() {
  class FakeIntersectionObserver {
    private record: { cb: (entries: Entry[]) => void; targets: Set<Element> }
    constructor(cb: (entries: Entry[]) => void) {
      this.record = { cb, targets: new Set() }
      observers.push(this.record)
    }
    observe(element: Element) {
      this.record.targets.add(element)
    }
    unobserve(element: Element) {
      this.record.targets.delete(element)
    }
    disconnect() {
      this.record.targets.clear()
    }
    takeRecords() {
      return []
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
}

/** Report one element's visibility ratio, to the observers watching it. */
function setVisible(element: Element, ratio: number) {
  act(() => {
    for (const observer of observers) {
      if (!observer.targets.has(element)) continue
      observer.cb([{ target: element, isIntersecting: ratio > 0, intersectionRatio: ratio }])
    }
  })
}

function cards() {
  return [...document.querySelectorAll<HTMLElement>('[data-team-card]')]
}

function setAllVisible(ratio: number) {
  for (const card of cards()) setVisible(card, ratio)
}

function videos() {
  return [...document.querySelectorAll<HTMLVideoElement>('video')]
}

function firstFrame(video: HTMLVideoElement) {
  act(() => {
    video.dispatchEvent(new Event('loadeddata'))
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  observers = []
  reducedMotion = false
  installObserver()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({
      matches: reducedMotion,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

/** End the clip that is currently mounted and let its crossfade finish. */
function endCurrentClip() {
  fireEvent.ended(videos()[0]!)
  tick(TEAM_VIDEO_CROSSFADE_MS)
}

describe('TeamSection flag', () => {
  it('is off while the roster still holds placeholders, and renders nothing', () => {
    expect(TEAM_SECTION_ENABLED).toBe(false)
    expect(TEAM_MEMBERS.some((member) => /Team member \d\d/.test(member.name))).toBe(true)

    const { container } = render(<TeamSection />)
    expect(container.querySelector('section.team')).toBeNull()
    expect(container.querySelector('[data-team-card]')).toBeNull()
    expect(videos()).toHaveLength(0)
  })

  it('renders the strip only when explicitly enabled', () => {
    render(<TeamSection enabled />)
    expect(document.querySelectorAll('[data-team-card]')).toHaveLength(TEAM_MEMBERS.length)
  })
})

describe('TeamSection media policy', () => {
  it('renders three cards, watches each of them, and mounts no video yet', () => {
    render(<TeamSection enabled />)
    const rendered = cards()
    expect(rendered).toHaveLength(TEAM_MEMBERS.length)
    expect(observers.flatMap((observer) => [...observer.targets]).filter((element) => rendered.includes(element as HTMLElement)))
      .toHaveLength(TEAM_MEMBERS.length)
    expect(videos()).toHaveLength(0)
    // The poster carries the card without a clip.
    expect(document.querySelectorAll('.team-card__poster')).toHaveLength(TEAM_MEMBERS.length)
  })

  it('mounts no decoder until the card is at least half in view', () => {
    render(<TeamSection enabled />)
    const card = cards()[0]!

    setVisible(card, 0.49)
    expect(videos()).toHaveLength(0)

    setVisible(card, 0.5)
    expect(videos()).toHaveLength(1)
    expect(videos()[0]!.getAttribute('src')).toBe(TEAM_MEMBERS[0]!.videoSrc)
    expect(videos()[0]!.muted).toBe(true)
    expect(videos()[0]!.hasAttribute('playsinline')).toBe(true)
    expect(videos()[0]!.getAttribute('preload')).toBe('auto')
    // Decorative: the name and role in the card body carry the content.
    expect(videos()[0]!.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps at most one video mounted while every card is in view', () => {
    render(<TeamSection enabled />)
    setAllVisible(1)
    expect(videos()).toHaveLength(1)
    expect(videos()[0]!.getAttribute('src')).toBe(TEAM_MEMBERS[0]!.videoSrc)

    // Card 1 finishes: its crossfade ends and the permit moves to card 2.
    endCurrentClip()
    expect(videos()).toHaveLength(1)
    expect(videos()[0]!.getAttribute('src')).toBe(TEAM_MEMBERS[1]!.videoSrc)

    endCurrentClip()
    expect(videos()).toHaveLength(1)
    expect(videos()[0]!.getAttribute('src')).toBe(TEAM_MEMBERS[2]!.videoSrc)

    // The strip ends on the posters: nothing left decoding.
    endCurrentClip()
    expect(videos()).toHaveLength(0)
    expect(document.querySelectorAll('.team-card__poster')).toHaveLength(3)
  })

  it('crossfades the clip in, then unmounts it after the crossfade back', () => {
    render(<TeamSection enabled />)
    setVisible(cards()[0]!, 1)
    const video = videos()[0]!
    expect(video.className).not.toContain('is-revealed')

    firstFrame(video)
    expect(video.className).toContain('is-revealed')

    fireEvent.ended(video)
    // Still mounted and fading out — the unmount waits for the crossfade.
    expect(videos()).toHaveLength(1)
    expect(video.className).toContain('is-leaving')

    tick(TEAM_VIDEO_CROSSFADE_MS - 1)
    expect(videos()).toHaveLength(1)
    tick(1)
    expect(videos()).toHaveLength(0)
    // One play per visit: the card stays on its poster even while still in view.
    tick(TEAM_VIDEO_CROSSFADE_MS * 4)
    expect(videos()).toHaveLength(0)
    expect(document.querySelectorAll('.team-card__poster')).toHaveLength(3)
  })

  it('releases the decoder when the card scrolls away mid-clip', () => {
    render(<TeamSection enabled />)
    const first = cards()[0]!
    setVisible(first, 1)
    expect(videos()).toHaveLength(1)

    setVisible(first, 0.2)
    expect(videos()).toHaveLength(0)
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()

    // The permit is free, so the next card into view can take it.
    setVisible(cards()[1]!, 1)
    expect(videos()).toHaveLength(1)
    expect(videos()[0]!.getAttribute('src')).toBe(TEAM_MEMBERS[1]!.videoSrc)
  })

  it('drops the source on unmount so the decoder is actually freed', () => {
    render(<TeamSection enabled />)
    setVisible(cards()[0]!, 1)
    const video = videos()[0]!
    setVisible(cards()[0]!, 0)
    expect(video.getAttribute('src')).toBeNull()
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled()
  })

  it('never mounts a clip under reduced motion', () => {
    reducedMotion = true
    render(<TeamSection enabled />)
    setAllVisible(1)
    expect(videos()).toHaveLength(0)
    expect(document.querySelectorAll('.team-card__poster')).toHaveLength(3)
  })

  it('keeps the poster and hands the permit on when a clip fails or stalls', () => {
    render(<TeamSection enabled />)
    // Only two cards are ever in view here, so the strip can go quiet.
    setVisible(cards()[0]!, 1)
    setVisible(cards()[1]!, 1)
    expect(videos()).toHaveLength(1)

    fireEvent.error(videos()[0]!)
    expect(videos()).toHaveLength(1)
    expect(videos()[0]!.getAttribute('src')).toBe(TEAM_MEMBERS[1]!.videoSrc)

    // That clip never produces a frame: the stall watchdog gives up.
    tick(TEAM_VIDEO_STALL_MS)
    expect(videos()).toHaveLength(0)
    expect(document.querySelectorAll('.team-card__poster')).toHaveLength(3)
  })

  it('mounts nothing for a member without a clip', () => {
    render(<TeamSection enabled members={[{ ...TEAM_MEMBERS[0]!, id: 'still', videoSrc: undefined }]} />)
    setVisible(cards()[0]!, 1)
    tick(TEAM_VIDEO_STALL_MS)
    expect(videos()).toHaveLength(0)
    expect(document.querySelector('.team-card__poster')!.textContent).toBe('01')
  })
})
