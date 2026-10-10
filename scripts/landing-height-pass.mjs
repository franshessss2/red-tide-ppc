#!/usr/bin/env node
/**
 * Landing document-height measurement pass.
 *
 * Reports the landing page's document height (and the height of the sections
 * that decide it) at fixed viewports, so a layout change can be proved not to
 * grow the page. Run against a production build:
 *
 *   npm run build && npm run preview
 *   npx playwright install chromium   # or set CHROMIUM_EXECUTABLE_PATH
 *   node scripts/landing-height-pass.mjs [BASE_URL]
 *
 * The first-visit intro is marked seen before load so the measurement is of the
 * landing document itself, not of the intro overlay. No data is modified.
 */
import { chromium } from 'playwright'

const baseURL = process.argv[2] ?? 'http://localhost:4173'
const viewports = [
  { label: '390x844', width: 390, height: 844 },
  { label: '1440x900', width: 1440, height: 900 },
]

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const results = []
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
    await context.addInitScript(() => {
      // Skip the first-visit intro reel (see src/components/intro/introGate.ts).
      window.localStorage.setItem('red-tide-ppc:intro:v3', 'seen')
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(baseURL, { waitUntil: 'networkidle' })
    await page.locator('main').waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(600)

    const measure = () =>
      page.evaluate(() => {
        const heightOf = (element) => (element ? Math.round(element.getBoundingClientRect().height) : null)
        const labelled = (label) => document.querySelector(`section[aria-label="${label}"]`)
        return {
          documentHeight: Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
            document.documentElement.offsetHeight,
          ),
          mainHeight: heightOf(document.querySelector('main')),
          footerHeight: heightOf(document.querySelector('footer')),
          reportActivityHeight: heightOf(document.querySelector('section.report-activity')),
          teamHeight: heightOf(document.querySelector('section.team')),
          teamCards: [...document.querySelectorAll('[data-team-card]')].map(heightOf),
          sections: [...document.querySelectorAll('section[aria-label], section.team, section.report-activity')].map((element) => ({
            label: element.getAttribute('aria-label') ?? element.className,
            height: heightOf(element),
            top: Math.round(element.getBoundingClientRect().top + window.scrollY),
          })),
        }
      })

    const beforeScroll = await measure()
    // Walk the page so every scroll-triggered reveal has resolved, then return
    // to the top: reveals animate opacity/transform, so the height must not move.
    for (const section of await page.locator('section[aria-label]').all()) {
      await section.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await page.waitForTimeout(350)
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(500)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(400)
    const afterScroll = await measure()

    results.push({
      viewport: viewport.label,
      beforeScroll,
      afterScroll,
      errors,
    })
    await context.close()
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify(results, null, 2))
