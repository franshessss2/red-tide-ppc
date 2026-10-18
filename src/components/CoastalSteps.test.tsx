// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CoastalSteps } from './CoastalSteps'
import { LandingMotionPolicy } from '../motion/LandingMotionPolicy'

const preference = vi.hoisted(() => ({ reduced: false }))
vi.mock('../motion/preferences', () => ({ useReducedMotion: () => preference.reduced }))
afterEach(() => { cleanup(); preference.reduced = false; vi.unstubAllGlobals() })

it.each(['reduced motion', 'Save-Data'])('keeps the illustrations static under %s without starting observers', policy => {
  const observer = vi.fn()
  vi.stubGlobal('IntersectionObserver', observer)
  preference.reduced = policy === 'reduced motion'
  render(<LandingMotionPolicy.Provider value={policy === 'Save-Data'}><CoastalSteps /></LandingMotionPolicy.Provider>)
  expect(observer).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Community review' })).toBeTruthy()
  expect(screen.getByText(/Check BFAR for official bulletins/)).toBeTruthy()
})
