// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { INTRO_SCENE_COPY, INTRO_SCENE_COUNT, IntroScene, sceneAnnouncement } from './IntroScenes'
// Raw sources for the static hygiene checks below (vite `?raw` imports).
// The stylesheet is read with fs because vitest's CSS pipeline empties
// `.css?raw`; the computed specifier keeps tsc on the app config happy.
import introScenesSource from './IntroScenes.tsx?raw'
import phoneMockSource from './PhoneMock.tsx?raw'
import introGateSource from './introGate.ts?raw'
import splashScreenSource from '../SplashScreen.tsx?raw'

const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as unknown as {
  readFileSync(path: string, encoding: string): string
}
// Vitest runs from the repository root (vitest.config.ts).
const introScenesCss = fs.readFileSync('src/styles/intro-scenes.css', 'utf8')

afterEach(cleanup)

describe('fixed copy', () => {
  it('matches the PR59 copy verbatim — no additions, no health claims', () => {
    expect(INTRO_SCENE_COUNT).toBe(5)
    expect(INTRO_SCENE_COPY).toEqual({
      1: ['Pula ang dagat.', 'Red tide.'],
      2: ['The sea can look normal.', 'The shellfish can still make you sick.', 'Cooking does not make it safe.'],
      3: ['See every zone.'],
      4: ['Report what you see.', 'Reviewed before an advisory is raised.'],
      5: ['One coast. A shared watch.', 'Community reports. Not a substitute for a BFAR advisory.'],
    })
  })

  it('renders scene 1 with the Filipino kicker small above the large English line', () => {
    const { container } = render(<IntroScene scene={1} state="in" />)
    const kicker = within(container).getByText('Pula ang dagat.')
    expect(kicker.getAttribute('lang')).toBe('fil')
    expect(kicker.classList.contains('tide-scene__kicker')).toBe(true)
    const headline = within(container).getByText('Red tide.')
    expect(headline.classList.contains('tide-scene__headline')).toBe(true)
  })

  it('renders every scene with exactly its fixed copy and nothing else', () => {
    for (let scene = 1; scene <= INTRO_SCENE_COUNT; scene++) {
      const { container, unmount } = render(<IntroScene scene={scene} state="in" />)
      const visibleText = container.textContent ?? ''
      const expected = INTRO_SCENE_COPY[scene].join('') + (scene === INTRO_SCENE_COUNT ? 'TAP TO ENTER' : '')
      expect(visibleText).toBe(expected)
      unmount()
    }
  })

  it('staggers the three scene-2 lines 450ms apart via CSS, with no timers', () => {
    const { container } = render(<IntroScene scene={2} state="in" />)
    const lines = [...container.querySelectorAll<HTMLElement>('.tide-scene__line')]
    expect(lines).toHaveLength(3)
    expect(lines.map((line) => line.style.getPropertyValue('--line-index'))).toEqual(['0', '1', '2'])
  })

  it('marks the final-scene hint decorative and renders no scene outside 1..5', () => {
    const { container } = render(<IntroScene scene={5} state="in" />)
    expect(container.querySelector('.tide-scene__hint')?.getAttribute('aria-hidden')).toBe('true')
    const none = render(<IntroScene scene={0} state="in" />)
    expect(none.container.textContent).toBe('')
    const over = render(<IntroScene scene={6} state="in" />)
    expect(over.container.textContent).toBe('')
  })

  it('announces "Step N of 5" plus the scene text, screen-reader only', () => {
    expect(sceneAnnouncement(0)).toBe('')
    expect(sceneAnnouncement(1)).toBe('Step 1 of 5. Pula ang dagat. Red tide.')
    expect(sceneAnnouncement(5)).toBe('Step 5 of 5. One coast. A shared watch. Community reports. Not a substitute for a BFAR advisory.')
  })
})

describe('phone mock', () => {
  it('is decorative, generic and text-free on both variants', () => {
    const zones = render(<IntroScene scene={3} state="in" />)
    const phone = zones.container.querySelector('.intro-phone--zones')!
    expect(phone.getAttribute('aria-hidden')).toBe('true')
    expect(phone.textContent).toBe('')
    expect(phone.querySelectorAll('.intro-phone__band--safe').length).toBeGreaterThan(0)
    expect(phone.querySelectorAll('.intro-phone__band--amber').length).toBeGreaterThan(0)
    expect(phone.querySelectorAll('.intro-phone__band--red').length).toBeGreaterThan(0)

    const report = render(<IntroScene scene={4} state="in" />)
    const reportPhone = report.container.querySelector('.intro-phone--report')!
    expect(reportPhone.getAttribute('aria-hidden')).toBe('true')
    expect(reportPhone.textContent).toBe('')
    expect(reportPhone.querySelector('.intro-phone__status-swap')).toBeTruthy()
  })
})

describe('source hygiene (static)', () => {
  const sources = [
    ['IntroScenes.tsx', introScenesSource],
    ['PhoneMock.tsx', phoneMockSource],
    ['introGate.ts', introGateSource],
    ['SplashScreen.tsx', splashScreenSource],
    ['intro-scenes.css', introScenesCss],
  ] as const

  it('never imports zones, coastline, shipping or Waves into the intro', () => {
    for (const [name, source] of sources) {
      expect(source.length, `${name} raw source must load`).toBeGreaterThan(0)
      expect(source, `${name} must not touch map data or the Waves canvas`).not.toMatch(
        /data\/(zones|coastline|shipping)|from\s+['"][^'"]*(zones|coastline|shipping|Waves)['"]/,
      )
    }
  })

  it('animates with transform and opacity only — no blur or backdrop filters', () => {
    // Strip comments: the file's own header documents these rules by name.
    const css = introScenesCss.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toMatch(/backdrop-filter|filter:\s*blur|will-change/)
    const blocks = css.match(/@keyframes[\s\S]*?\n\}/g) ?? []
    expect(blocks.length).toBeGreaterThan(0)
    for (const block of blocks) {
      const props = [...block.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      expect(props.length).toBeGreaterThan(0)
      for (const prop of props) expect(['transform', 'opacity']).toContain(prop)
    }
  })
})
