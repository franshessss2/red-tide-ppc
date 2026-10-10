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
  { label: '360x740', width: 360, height: 740 },
  { label: '844x390', width: 844, height: 390 },
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
      window.teamCLS = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.teamCLS += entry.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
      // Skip the first-visit intro reel (src/components/intro/introGate.ts).
      window.localStorage.setItem('red-tide-ppc:intro:v3', 'seen')
    })
    const page = await context.newPage()
    if (viewport.width === 390) {
      const session = await context.newCDPSession(page)
      await session.send('Network.enable')
      await session.send('Network.emulateNetworkConditions', {
        offline: false, latency: 400, downloadThroughput: 1600000 / 8, uploadThroughput: 750000 / 8,
      })
    }
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto(baseURL, { waitUntil: 'networkidle' })
    await page.locator('main').waitFor()
    await page.evaluate(() => document.fonts.ready)

    const strip = page.locator('section.team')
    const metrics = () => page.evaluate(() => {
      const paint = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null
      const resources = performance.getEntriesByType('resource')
      const rect = (el) => {
        const box = el.getBoundingClientRect()
        return { x: box.x, y: box.y + scrollY, width: box.width, height: box.height }
      }
      return {
        cls: window.teamCLS,
        firstContentfulPaintMs: paint,
        resourceTransferBytesStartedBeforeFCP: paint === null ? null : resources
          .filter((entry) => entry.startTime <= paint).reduce((total, entry) => total + entry.transferSize, 0),
        mediaRequests: resources.filter((entry) => entry.name.includes('/media/team/'))
          .map((entry) => ({ url: entry.name, bytes: entry.transferSize, startTime: entry.startTime })),
        otherSections: [...document.querySelectorAll('main section:not(.team),footer')]
          .map((el) => ({ tag: el.tagName, id: el.id, className: el.className, ...rect(el) })),
      }
    })
    const beforeScroll = await metrics()
    if ((await strip.count()) === 0) {
      if (process.env.TEAM_SHOTS_DISABLED === '1') {
        const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight)
        const fullPath = `${output}/landing-${viewport.label}-${label}.png`
        await page.screenshot({ path: fullPath, fullPage: true })
        results.push({ viewport: viewport.label, commit: sha, runId, flag: false,
          geometry: { documentHeight, teamHeight: null, cards: [] }, roleFit: {},
          metrics: await metrics(), errors, shots: { fullPath } })
        await context.close()
        continue
      }
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
        // 120px and 160px are the PHONE card heights. The ≥768px layout is a
        // column with a 140px media block on top, so pinning it to either
        // value would overflow by construction and say nothing about the text.
        // There the card is measured at its natural height instead.
        const applicable = cards.every((card) => getComputedStyle(card).flexDirection === 'row')
        const previous = cards.map((card) => card.style.cssText)
        if (applicable) {
          for (const card of cards) {
            card.style.height = `${height}px`
            card.style.maxHeight = `${height}px`
          }
        }
        // Force layout before measuring.
        void document.body.offsetHeight
        const measured = cards.map((card) => {
          const body = card.querySelector('.team-card__body')
          const role = card.querySelector('.team-card__role')
          const name = card.querySelector('.team-card__name')
          const cardRect = card.getBoundingClientRect()
          const roleRect = role?.getBoundingClientRect()
          const lineHeight = role ? parseFloat(getComputedStyle(role).lineHeight) || 0 : 0
          return {
            id: card.getAttribute('data-team-card'),
            applicable,
            cardHeight: round(cardRect.height),
            role: role?.textContent ?? null,
            roleHeight: roleRect ? round(roleRect.height) : 0,
            roleLines: lineHeight ? Math.round(roleRect.height / lineHeight) : null,
            nameHeight: name ? round(name.getBoundingClientRect().height) : 0,
            bodyScrollHeight: body.scrollHeight,
            bodyClientHeight: body.clientHeight,
            bodyOverflows: body.scrollHeight > body.clientHeight + 1,
            roleBottomOverflowPx: round(Math.max(0, (roleRect?.bottom ?? cardRect.bottom) - cardRect.bottom)),
            clipped:
              body.scrollHeight > body.clientHeight + 1 || (roleRect && roleRect.bottom > cardRect.bottom + 1),
          }
        })
        cards.forEach((card, index) => { card.style.cssText = previous[index] })
        void document.body.offsetHeight
        return measured
      }, cardHeight)

    const roleFit = {}
    for (const height of CARD_HEIGHTS) {
      const measured = await fitAt(height)
      // Desktop ignores the forced height, so record it once, not per height.
      if (measured.every((card) => !card.applicable)) {
        roleFit.natural = measured
        break
      }
      roleFit[`${height}px`] = measured
    }

    const fullPath = `${output}/landing-${viewport.label}-${label}.png`
    const stripPath = `${output}/team-strip-${viewport.label}-${label}.png`
    await page.screenshot({ path: fullPath, fullPage: true })
    await strip.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    await strip.screenshot({ path: stripPath })

    results.push({ viewport: viewport.label, commit: sha, runId, flag: true, geometry, roleFit,
      beforeScroll, metrics: await metrics(), errors, shots: { fullPath, stripPath } })
    await context.close()
  }
} finally {
  await browser.close()
}

const summary = { commit: sha, runId, baseURL, capturedAt: new Date().toISOString(), results }
await writeFile(`${output}/measurements-${label}.json`, `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))

// A markdown digest as well as the JSON: the workflow posts this to the PR, so
// the numbers outlive the artifact (and are readable without downloading it).
const md = [
  `### Team strip capture — \`${sha.slice(0, 7)}\` · run [${runId}](https://github.com/${process.env.GITHUB_REPOSITORY ?? 'franshessss2/red-tide-ppc'}/actions/runs/${runId})`,
  '',
  'Captured against a build with `TEAM_SECTION_ENABLED` forced on for the measurement only; the committed flag stays `false`. Empty slots render no name, role or media; no placeholder people or missing-media requests are generated.',
  '',
  '| viewport | document height | team strip | card heights | poster loaded |',
  '| --- | --- | --- | --- | --- |',
  ...results.map((r) => {
    const g = r.geometry
    return `| ${r.viewport} | ${g.documentHeight}px | ${g.teamHeight}px | ${g.cards.map((c) => `${c.height}px`).join(', ')} | ${g.cards.map((c) => (c.posterLoaded ? 'yes' : 'no')).join(', ')} |`
  }),
  '',
  '**Role fit** (card pinned to each height; `clipped` = name/role ink outside the card box)',
  '',
  '`120px` and `160px` are the phone card heights. At >=768px the card is a column with a 140px media block on top, so those heights do not apply there and the card is measured at its natural height instead.',
  '',
  '| viewport | card height | entry | role | role lines | body scroll/client | clipped |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...results.flatMap((r) =>
    Object.entries(r.roleFit).flatMap(([height, cards]) =>
      cards.map((c) =>
        c.applicable
          ? `| ${r.viewport} | ${height} | ${c.id} | ${c.role} | ${c.roleLines} | ${c.bodyScrollHeight}/${c.bodyClientHeight} | ${c.clipped ? '**YES**' : 'no'} |`
          : `| ${r.viewport} | n/a (${c.cardHeight}px natural) | ${c.id} | ${c.role} | ${c.roleLines} | ${c.bodyScrollHeight}/${c.bodyClientHeight} | ${c.clipped ? '**YES**' : 'no'} |`,
      ),
    ),
  ),
  '',
  `Page errors: ${results.flatMap((r) => r.errors).length === 0 ? 'none' : results.flatMap((r) => r.errors).join('; ')}`,
  '',
  `Screenshots (full page + strip, both viewports) are in artifact \`team-roster-shots-${sha}-run${runId}\`.`,
  '',
].join('\n')
await writeFile(`${output}/summary-${label}.md`, `${md}\n`)

const clipped = results.flatMap((result) =>
  Object.entries(result.roleFit).flatMap(([height, cards]) =>
    cards
      .filter((card) => card.applicable && card.clipped)
      .map((card) => `${result.viewport} @${height} ${card.id}: "${card.role}"`),
  ),
)
console.log(clipped.length === 0 ? '\nrole fit: OK at 120px and 160px (phone layout), no clipping' : `\nrole fit: CLIPPED\n${clipped.join('\n')}`)
const pageErrors = results.flatMap((result) => result.errors)
if (pageErrors.length > 0) {
  console.error(`\npage errors:\n${pageErrors.join('\n')}`)
  process.exit(1)
}
