// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INTRO_SEEN_KEY, hasSeenIntro, introReplayRequested, markIntroSeen, shouldShowIntro } from './introGate'

let reduced = false

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  reduced = false
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced } }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const at = (pathname: string, search = '', hash = '') => ({ pathname, search, hash })

describe('introGate', () => {
  it('uses the versioned localStorage key red-tide-ppc:intro:v3', () => {
    expect(INTRO_SEEN_KEY).toBe('red-tide-ppc:intro:v3')
    markIntroSeen()
    expect(localStorage.getItem('red-tide-ppc:intro:v3')).toBe('seen')
    expect(sessionStorage.getItem('red-tide-ppc:intro:v3')).toBeNull()
  })

  it('shows the intro on "/" for a first visit', () => {
    expect(shouldShowIntro(at('/'))).toBe(true)
  })

  it('never shows the intro on /map or /admin or any other pathname', () => {
    expect(shouldShowIntro(at('/map'))).toBe(false)
    expect(shouldShowIntro(at('/admin'))).toBe(false)
    expect(shouldShowIntro(at('/anything'))).toBe(false)
  })

  it('does not show the intro once the key is present', () => {
    markIntroSeen()
    expect(hasSeenIntro()).toBe(true)
    expect(shouldShowIntro(at('/'))).toBe(false)
  })

  it('lets the intro present a static equivalent under reduced motion', () => {
    reduced = true
    expect(shouldShowIntro(at('/'))).toBe(true)
    expect(shouldShowIntro(at('/', '?intro=1'))).toBe(true)
  })

  it('skips the intro for deep links with a hash (PR57 behavior preserved)', () => {
    expect(shouldShowIntro(at('/', '', '#reports'))).toBe(false)
  })

  it('fails open when storage reads throw: intro skipped, content shown', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(hasSeenIntro()).toBe(true)
    expect(shouldShowIntro(at('/'))).toBe(false)
  })

  it('swallows storage write failures without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => markIntroSeen()).not.toThrow()
  })

  it('?intro=1 forces one replay without clearing storage', () => {
    markIntroSeen()
    expect(introReplayRequested('?intro=1')).toBe(true)
    expect(shouldShowIntro(at('/', '?intro=1'))).toBe(true)
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBe('seen')
    expect(shouldShowIntro(at('/'))).toBe(false)
    // The forced replay never applies off the landing route.
    expect(shouldShowIntro(at('/map', '?intro=1'))).toBe(false)
  })
})
