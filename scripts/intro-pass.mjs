#!/usr/bin/env node
/**
 * PR59 real-browser pass for the tap-to-advance intro.
 * Run against the isolated demo server (localStorage only, no live data):
 *   npm run dev            # scripts/demo.mjs on :5173
 *   node scripts/intro-pass.mjs [BASE_URL]
 * Optional CHROMIUM_EXECUTABLE_PATH for an already installed browser.
 * Screenshots/measurements go to ignored .cache/intro-pass by default;
 * set INTRO_OUTPUT_DIR to keep them elsewhere. No repo data is modified.
 *
 * Checks per viewport (320x568, 360x740, 390x844, 844x390, 1440x600, 1440x900):
 *  - a screenshot of every scene (0..5),
 *  - no horizontal overflow of any visible intro element,
 *  - the Skip hit target is at least 44x44 CSS px on every scene,
 *  - a full run takes exactly six taps and ends on the landing page,
 *  - Skip works from scene 0 and marks the versioned seen key,
 *  - the seen key holds across reload,
 *  - /map and /admin never show the intro,
 *  - reduced motion shows no intro at all.
 */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const baseURL = process.argv[2] ?? 'http://localhost:5173'
const output = resolve(process.env.INTRO_OUTPUT_DIR ?? '.cache/intro-pass')
await mkdir(output, { recursive: true })

const SEEN_KEY = 'red-tide-ppc:intro:v2'
const DIALOG = '[role="dialog"][aria-label="Introduction"]'
const ADVANCE = '.tide-intro__advance'
const SKIP = '.tide-intro__skip'
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 600 },
  { width: 1440, height: 900 },
]
// Scene settle times: scene 2 staggers 3 lines 450ms apart; scene 4 adds the
// status-band crossfade after 3 stagger steps.
const SETTLE = { 0: 2300, 1: 700, 2: 1600, 3: 1100, 4: 2100, 5: 900 }

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const results = []

async function freshPage(viewport, options = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...options })
  const page = await context.newPage()
  page.on('pageerror', (error) => results.push({ level: 'pageerror', message: error.message }))
  return { context, page }
}

/** Visible intro content must sit inside the viewport; the 200%-wide wave
 *  layers live inside overflow-hidden clips and are checked via scrollbars. */
async function assertNoHorizontalOverflow(page, label) {
  const report = await page.evaluate(() => {
    const doc = document.documentElement
    const offenders = [...document.querySelectorAll(
      '.tide-scenes *, .tide-intro__skip, .tide-intro__top *, .tide-intro__bottom *, .tide-intro__copy *, .tide-intro__hint',
    )].filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1)
    }).map((element) => `${element.tagName}.${String(element.className).slice(0, 60)}`)
    return { scrollX: doc.scrollWidth - doc.clientWidth, offenders }
  })
  assert.ok(report.scrollX <= 1, `${label}: document scrolls horizontally by ${report.scrollX}px`)
  assert.deepEqual(report.offenders, [], `${label}: intro content leaves the viewport: ${report.offenders.join(', ')}`)
}

async function assertSkipTarget(page, label) {
  const box = await page.locator(SKIP).boundingBox()
  assert.ok(box, `${label}: Skip button missing`)
  assert.ok(box.width >= 44 && box.height >= 44, `${label}: Skip hit target ${box.width}x${box.height} < 44px`)
  const ariaLabel = await page.locator(SKIP).getAttribute('aria-label')
  assert.equal(ariaLabel, 'Skip introduction', `${label}: Skip aria-label`)
}

try {
  for (const viewport of VIEWPORTS) {
    const vp = `${viewport.width}x${viewport.height}`

    // ---- full run: six taps, one screenshot per scene --------------------
    {
      const { context, page } = await freshPage(viewport)
      await page.goto(baseURL, { waitUntil: 'networkidle' })
      await page.locator(DIALOG).waitFor()
      for (let scene = 0; scene <= 5; scene++) {
        await page.waitForTimeout(SETTLE[scene])
        const observed = await page.locator('.tide-intro').getAttribute('data-scene')
        assert.equal(observed, String(scene), `${vp}: expected scene ${scene}, intro is on ${observed}`)
        await assertNoHorizontalOverflow(page, `${vp} scene ${scene}`)
        await assertSkipTarget(page, `${vp} scene ${scene}`)
        await page.screenshot({ path: resolve(output, `scene-${scene}-${vp}.png`) })
        if (scene < 5) await page.locator(ADVANCE).click() // taps 1..5
      }
      // Sixth tap: the PR57 exit. The intro must still be present before it.
      assert.equal(await page.locator(DIALOG).count(), 1, `${vp}: intro left before the sixth tap`)
      await page.locator(ADVANCE).click()
      await page.locator(DIALOG).waitFor({ state: 'detached', timeout: 5000 })
      await page.screenshot({ path: resolve(output, `after-exit-${vp}.png`) })
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), SEEN_KEY), 'seen', `${vp}: exit did not mark seen`)
      await page.locator('.landing-map-cta').waitFor()

      // ---- seen key holds on reload ------------------------------------
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)
      assert.equal(await page.locator(DIALOG).count(), 0, `${vp}: intro reappeared after reload with seen key`)
      await page.locator('.landing-map-cta').waitFor()
      results.push({ viewport: vp, fullRun: 'six taps', reload: 'no intro' })
      await context.close()
    }

    // ---- Skip works from scene 0 -----------------------------------------
    {
      const { context, page } = await freshPage(viewport)
      await page.goto(baseURL, { waitUntil: 'networkidle' })
      await page.locator(DIALOG).waitFor()
      await page.locator(SKIP).click()
      await page.locator(DIALOG).waitFor({ state: 'detached', timeout: 5000 })
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), SEEN_KEY), 'seen', `${vp}: skip did not mark seen`)
      await page.locator('.landing-map-cta').waitFor()
      results.push({ viewport: vp, skipFromScene0: 'pass' })
      await context.close()
    }

    // ---- /map and /admin never show the intro -----------------------------
    {
      const { context, page } = await freshPage(viewport)
      for (const path of ['/map', '/admin']) {
        await page.goto(baseURL + path, { waitUntil: 'networkidle' })
        await page.waitForTimeout(2000)
        assert.equal(await page.locator('.tide-intro').count(), 0, `${vp}: intro appeared on ${path}`)
      }
      results.push({ viewport: vp, routes: '/map and /admin clean' })
      await context.close()
    }

    // ---- reduced motion: no intro at all ----------------------------------
    {
      const { context, page } = await freshPage(viewport, { reducedMotion: 'reduce' })
      await page.goto(baseURL, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1000)
      assert.equal(await page.locator('.tide-intro').count(), 0, `${vp}: intro rendered under reduced motion`)
      await page.locator('.landing-map-cta').waitFor()
      results.push({ viewport: vp, reducedMotion: 'no intro' })
      await context.close()
    }
  }

  const errors = results.filter((entry) => entry.level === 'pageerror')
  assert.deepEqual(errors, [], `page errors: ${JSON.stringify(errors)}`)
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2))
  console.log(`intro-pass: PASS (${VIEWPORTS.length} viewports). Output: ${output}`)
} finally {
  await browser.close()
}
