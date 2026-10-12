// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LandingMotionPolicy, useSaveData } from './LandingMotionPolicy'
import { TextReveal } from '../components/TextReveal'
import { BlurText } from '../components/BlurText'
import { TextPressure } from '../components/TextPressure'
import { HeroBackdrop } from '../components/HeroBackdrop'
import { Landing } from '../pages/Landing'

let reduced = false
let network: EventTarget & { saveData: boolean }
vi.mock('./preferences', () => ({ useReducedMotion: () => reduced, usePageVisible: () => true }))
const fluid = vi.hoisted(() => ({ imports: 0 }))
vi.mock('../components/ferrofluid/Ferrofluid', () => {
  fluid.imports++
  return { default: () => <canvas data-testid="fluid" /> }
})
beforeEach(() => {
  reduced = false
  network = Object.assign(new EventTarget(), { saveData: false })
  vi.stubGlobal('navigator', { connection: network })
  vi.stubGlobal('IntersectionObserver', undefined)
  fluid.imports = 0
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function Preference() {
  return <p>{useSaveData() ? 'static' : 'motion'}</p>
}
it('reads Save-Data on the first render and responds when it changes', () => {
  network.saveData = true
  render(<Preference />)
  expect(screen.getByText('static')).toBeTruthy()
  act(() => { network.saveData = false; network.dispatchEvent(new Event('change')) })
  expect(screen.getByText('motion')).toBeTruthy()
})
it('removes the connection listener on unmount', () => {
  const remove = vi.spyOn(network, 'removeEventListener')
  const view = render(<Preference />)
  view.unmount()
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function))
})
it('supports browsers without the Network Information API', () => {
  vi.stubGlobal('navigator', {})
  render(<Preference />)
  expect(screen.getByText('motion')).toBeTruthy()
})
it.each(['save-data', 'reduced-motion'])('renders static copy and no shader import for %s', async mode => {
  reduced = mode === 'reduced-motion'
  render(<LandingMotionPolicy.Provider value={mode === 'save-data'}>
    <TextReveal text="Readable title" /><BlurText text="Readable description" />
    <TextPressure text="RED TIDE" /><HeroBackdrop />
  </LandingMotionPolicy.Provider>)
  await act(async () => {})
  expect(screen.getByText('Readable title').querySelectorAll('span').length).toBe(0)
  expect(screen.getByText('Readable description').querySelectorAll('span').length).toBe(0)
  expect(document.querySelector('[data-text-pressure-letter]')).toBeNull()
  expect(screen.queryByTestId('fluid')).toBeNull()
  expect(fluid.imports).toBe(0)
  expect(screen.getByTestId('hero-static-backdrop')).toBeTruthy()
})
it('keeps the intro-style word reveal unchanged outside the landing provider', () => {
  network.saveData = true
  render(<TextReveal text="Intro words" effect="words" trigger="mount" />)
  expect(screen.getByLabelText('Intro words').querySelectorAll('span[aria-hidden]').length).toBe(2)
})
it.each(['save-data', 'reduced-motion'])('keeps landing CTAs readable without canvases for %s', mode => {
  reduced = mode === 'reduced-motion'
  network.saveData = mode === 'save-data'
  const view = render(<MemoryRouter><Landing /></MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Open the map' }).getAttribute('href')).toBe('/map')
  expect(screen.getByRole('link', { name: 'Report a sighting' }).getAttribute('href')).toBe('/map')
  expect(screen.getByRole('heading', { name: 'Red Tide' })).toBeTruthy()
  expect(view.container.querySelector('[data-text-pressure-letter]')).toBeNull()
  expect(view.container.querySelector('[data-testid="hero-backdrop"] canvas')).toBeNull()
  if (network.saveData) expect(view.container.querySelector('canvas')).toBeNull()
})
