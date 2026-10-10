#!/usr/bin/env node
/**
 * Real-browser check of the landing team strip's media policy.
 *
 * The unit tests (src/components/TeamSection.test.tsx) drive the rules with a
 * stubbed IntersectionObserver and a stubbed media pipeline. This pass checks
 * the same three rules in Chromium against the real thing:
 *
 *   1. no `<video>` is mounted before its card is ~50% in view,
 *   2. at most one `<video>` is mounted — i.e. decoding — at any moment,
 *   3. every clip is gone from the DOM once its crossfade has finished.
 *
 * Run against a production build:
 *   npm run build && npm run preview
 *   npx playwright install chromium   # or set CHROMIUM_EXECUTABLE_PATH
 *   node scripts/landing-team-video-pass.mjs [BASE_URL]
 *
 * No reports or live data are modified.
 */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseURL = process.argv[2] ?? 'http://localhost:4173'
/** Long enough for the three 3s clips plus their crossfades, played in turn. */
const SETTLE_MS = 20000

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const results = []
try {
  // Probe once: while the roster holds placeholders the strip is disabled and
  // there is nothing to check. Skip rather than fail.
  {
    const probe = await browser.newContext()
    const page = await probe.newPage()
    await page.goto(baseURL, { waitUntil: 'networkidle' })
    const count = await page
      .evaluate(() => document.querySelectorAll('[data-team-card]').length)
      .catch(() => 0)
    await probe.close()
    if (count === 0) {
      console.log(JSON.stringify({ skipped: true, reason: 'team section disabled (placeholder roster)' }, null, 2))
      console.log('team video policy pass: skipped (section disabled)')
      process.exit(0)
    }
  }

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
    await context.addInitScript(() => {
      window.localStorage.setItem('red-tide-ppc:intro:v3', 'seen')
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('requestfailed', (request) => {
      if (request.url().includes('/media/team/')) errors.push(`request failed: ${request.url()}`)
    })

    await page.goto(baseURL, { waitUntil: 'networkidle' })
    await page.locator('[data-team-card]').first().waitFor()

    /** Mounted clips plus each card's visible fraction, sampled from the page. */
    const sample = () =>
      page.evaluate(() => {
        const videos = [...document.querySelectorAll('video')]
        return {
          scrollY: Math.round(window.scrollY),
          mounted: videos.map((video) => ({
            src: video.currentSrc || video.getAttribute('src'),
            className: video.className,
            currentTime: Number(video.currentTime.toFixed(2)),
            readyState: video.readyState,
            paused: video.paused,
          })),
          cards: [...document.querySelectorAll('[data-team-card]')].map((card) => {
            const rect = card.getBoundingClientRect()
            const visible = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0))
            return {
              id: card.getAttribute('data-team-card'),
              fraction: rect.height ? Number((visible / rect.height).toFixed(2)) : 0,
              hasVideo: card.querySelector('video') !== null,
            }
          }),
        }
      })

    // Rule 1, from the top of the page: the strip is below the fold.
    const atTop = await sample()
    assert.equal(atTop.mounted.length, 0, 'a clip was mounted before the strip was scrolled to')

    // Walk down in small steps, sampling at every step.
    const samples = [atTop]
    const step = Math.round(viewport.height / 4)
    const bottom = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y <= bottom; y += step) {
      await page.evaluate((next) => window.scrollTo(0, next), y)
      await page.waitForTimeout(220)
      samples.push(await sample())
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

    // Rule 3: stay at the bottom and watch the clips play in turn until the
    // strip goes quiet — every one of them has to unmount after its crossfade.
    const startedAt = Date.now()
    let settled = await sample()
    let quietSince = settled.mounted.length === 0 ? Date.now() : null
    const timeline = []
    while (Date.now() - startedAt < SETTLE_MS) {
      await page.waitForTimeout(200)
      settled = await sample()
      samples.push(settled)
      for (const clip of settled.mounted) {
        timeline.push({
          t: Date.now() - startedAt,
          src: clip.src?.split('/').pop(),
          className: clip.className.trim(),
          currentTime: clip.currentTime,
          readyState: clip.readyState,
          paused: clip.paused,
        })
      }
      if (settled.mounted.length === 0) {
        if (quietSince === null) quietSince = Date.now()
        else if (Date.now() - quietSince > 3000) break
      } else {
        quietSince = null
      }
    }

    const maxMounted = Math.max(...samples.map((s) => s.mounted.length), settled.mounted.length)
    const earlyMounts = samples.flatMap((s) =>
      s.cards.filter((card) => card.hasVideo && card.fraction < 0.5).map((card) => ({
        scrollY: s.scrollY,
        card: card.id,
        fraction: card.fraction,
      })),
    )
    const clipRequests = samples
      .flatMap((s) => s.mounted.map((m) => m.src))
      .filter((value, index, all) => all.indexOf(value) === index)

    assert.equal(maxMounted, 1, `peak concurrent clips was ${maxMounted}, expected at most 1`)
    assert.deepEqual(earlyMounts, [], 'a clip was mounted while its card was under 50% visible')
    assert.equal(settled.mounted.length, 0, 'a clip was still mounted after its crossfade')

    results.push({
      viewport: `${viewport.width}x${viewport.height}`,
      maxConcurrentClips: maxMounted,
      mountedWhileUnder50Percent: earlyMounts,
      clipsStillMountedAtRest: settled.mounted.length,
      clipPlaybackOrder: clipRequests.map((src) => src?.split('/').pop()),
      firstFrameOfFirstClip: timeline.find((entry) => entry.className.includes('is-revealed')),
      timelineFrames: timeline.length,
      samples: samples.length,
      errors,
    })
    await context.close()
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify(results, null, 2))
console.log('team video policy pass: OK')
