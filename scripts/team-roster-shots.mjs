#!/usr/bin/env node
/**
 * Landing screenshots + height/fit measurements for the team strip.
 *
 * The dev sandbox has no browser and cannot reach any browser CDN (egress is
 * blocked), so — like scripts/inlet-shots.mjs — this runs on a GitHub runner.
 * See .github/workflows/team-roster-shots.yml, which enables the strip for the
 * duration of the capture only; the shipped flag stays off.
 *
 * What it records, at 390x844 and 1440x900:
 *   - landing document height, with the strip enabled,
 *   - the strip's height and each card's height,
 *   - whether the role line fits, at BOTH the 120px and the 160px card height
 *     (the phone CSS has carried both; "Front-end and back-end developer" is
 *     the longest role and the one at risk of clipping),
 *   - a full-page shot and a tight shot of the strip.
 *
 * Run against a production build:
 *   npm run build && npm run preview
 *   npx playwright install chromium   # or set CHROMIUM_EXECUTABLE_PATH
 *   node scripts/team-roster-shots.mjs [BASE_URL]
 *
 * No reports or live data are modified.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const baseURL = process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:4173'
const output = resolve(process.env.TEAM_SHOTS_OUTPUT_DIR ?? '.cache/team-roster-shots')
const sha = process.env.GITHUB_SHA ?? 'local'
const runId = process.env.GITHUB_RUN_ID ?? 'local'
const label = `${sha.slice(0, 7)}-run${runId}`

await mkdir(output, { recursive: true })

const viewports = [
  { label: '390x844', width: 390, height: 844 },
  { label: '1440x900', width: 1440, height: 900 },
]
/** The two card heights the phone CSS has used; both are checked for fit. */
const CARD_HEIGHTS = [120, 160]

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const results = []
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    })
    await context.addInitScript(() => {
      // Skip the first-visit intro reel (src/components/intro/introGate.ts).
      window.localStorage.setItem('red-tide-ppc:intro:v3', 'seen')
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto(baseURL, { waitUntil: 'networkidle' })
    await page.locator('main').waitFor()
    await page.evaluate(() => document.fonts.ready)

    const strip = page.locator('section.team')
    if ((await strip.count()) === 0) {
      throw new Error(
        'No section.team in the DOM. The capture must run against a build with ' +
          'TEAM_SECTION_ENABLED forced on — see the workflow.',
      )
    }
    await strip.scrollIntoViewIfNeeded()
    // Let the scroll-triggered reveals finish so the height is the settled one.
    await page.waitForTimeout(1200)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(600)

    const geometry = await page.evaluate(() => {
      const round = (n) => Math.round(n * 100) / 100
      const heightOf = (el) => (el ? Math.round(el.getBoundingClientRect().height) : null)
      return {
        documentHeight: Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
          document.documentElement.offsetHeight,
        ),
        mainHeight: heightOf(document.querySelector('main')),
        footerHeight: heightOf(document.querySelector('footer')),
        teamHeight: heightOf(document.querySelector('section.team')),
        cards: [...document.querySelectorAll('[data-team-card]')].map((card) => ({
          id: card.getAttribute('data-team-card'),
          height: round(card.getBoundingClientRect().height),
          name: card.querySelector('.team-card__name')?.textContent ?? null,
          role: card.querySelector('.team-card__role')?.textContent ?? null,
          posterImage: card.querySelector('.team-card__poster-image')?.getAttribute('src') ?? null,
          // A 404 still is the case the initials fallback exists for.
          posterLoaded: (() => {
            const img = card.querySelector('.team-card__poster-image')
            return img ? img.complete && img.naturalWidth > 0 : null
          })(),
          initials: card.querySelector('.team-card__poster')?.textContent ?? null,
        })),
      }
    })

    /**
     * Force each card to a given height and ask whether the text still fits.
     * `clipped` is the honest answer: does any of the name/role ink fall
     * outside the card's own box once it is pinned to that height.
     */
    const fitAt = async (cardHeight) =>
      page.evaluate((height) => {
        const round = (n) => Math.round(n * 100) / 100
        const cards = [...document.querySelectorAll('[data-team-card]')]
        const previous = cards.map((card) => card.style.cssText)
        for (const card of cards) {
          card.style.height = `${height}px`
          card.style.maxHeight = `${height}px`
        }
        // Force layout before measuring.
        void document.body.offsetHeight
        const measured = cards.map((card) => {
          const body = card.querySelector('.team-card__body')
          const role = card.querySelector('.team-card__role')
          const name = card.querySelector('.team-card__name')
          const cardRect = card.getBoundingClientRect()
          const roleRect = role.getBoundingClientRect()
          const lineHeight = parseFloat(getComputedStyle(role).lineHeight) || 0
          return {
            id: card.getAttribute('data-team-card'),
            role: role.textContent,
            roleHeight: round(roleRect.height),
            roleLines: lineHeight ? Math.round(roleRect.height / lineHeight) : null,
            nameHeight: round(name.getBoundingClientRect().height),
            bodyScrollHeight: body.scrollHeight,
            bodyClientHeight: body.clientHeight,
            bodyOverflows: body.scrollHeight > body.clientHeight + 1,
            roleBottomOverflowPx: round(Math.max(0, roleRect.bottom - cardRect.bottom)),
            clipped:
              body.scrollHeight > body.clientHeight + 1 || roleRect.bottom > cardRect.bottom + 1,
          }
        })
        cards.forEach((card, index) => { card.style.cssText = previous[index] })
        void document.body.offsetHeight
        return measured
      }, cardHeight)

    const roleFit = {}
    for (const height of CARD_HEIGHTS) roleFit[`${height}px`] = await fitAt(height)

    const fullPath = `${output}/landing-${viewport.label}-${label}.png`
    const stripPath = `${output}/team-strip-${viewport.label}-${label}.png`
    await page.screenshot({ path: fullPath, fullPage: true })
    await strip.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    await strip.screenshot({ path: stripPath })

    results.push({ viewport: viewport.label, commit: sha, runId, geometry, roleFit, errors, shots: { fullPath, stripPath } })
    await context.close()
  }
} finally {
  await browser.close()
}

const summary = { commit: sha, runId, baseURL, capturedAt: new Date().toISOString(), results }
await writeFile(`${output}/measurements-${label}.json`, `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))

const clipped = results.flatMap((result) =>
  Object.entries(result.roleFit).flatMap(([height, cards]) =>
    cards.filter((card) => card.clipped).map((card) => `${result.viewport} @${height} ${card.id}: "${card.role}"`),
  ),
)
console.log(clipped.length === 0 ? '\nrole fit: OK at 120px and 160px, both viewports' : `\nrole fit: CLIPPED\n${clipped.join('\n')}`)
const pageErrors = results.flatMap((result) => result.errors)
if (pageErrors.length > 0) {
  console.error(`\npage errors:\n${pageErrors.join('\n')}`)
  process.exit(1)
}
