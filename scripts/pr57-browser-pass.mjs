import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import { PNG } from 'pngjs'

const BASE = 'http://127.0.0.1:4173'
const OUT = 'pr57-artifacts'
const viewports = [
  { name: '390x844', width: 390, height: 844 },
  { name: '360x740', width: 360, height: 740 },
  { name: '1440x900', width: 1440, height: 900 },
]
const idleMarks = [500, 1500, 3000, 6000, 10000, 30000]
const errors = []
const results = []

await fs.rm(OUT, { recursive: true, force: true })
await fs.mkdir(OUT, { recursive: true })

function parseMatrixY(transform) {
  const match = transform.match(/^matrix3?\((.+)\)$/)
  if (!match) return null
  const parts = match[1].split(',').map(Number)
  return transform.startsWith('matrix3d') ? parts[13] : parts[5]
}

function comparePng(a, b) {
  const pa = PNG.sync.read(a)
  const pb = PNG.sync.read(b)
  if (pa.width !== pb.width || pa.height !== pb.height) {
    return { equal: false, differing: pa.width * pa.height, total: pa.width * pa.height, maxDelta: 255 }
  }
  let differing = 0
  let maxDelta = 0
  for (let i = 0; i < pa.data.length; i++) {
    const d = Math.abs(pa.data[i] - pb.data[i])
    if (d) differing++
    if (d > maxDelta) maxDelta = d
  }
  return { equal: differing === 0, differing, total: pa.data.length, maxDelta }
}

async function waitIdle(page) {
  await page.waitForSelector('.tide-experience--idle', { state: 'attached', timeout: 5000 })
  await page.waitForSelector('.tide-intro__wave-layer--front', { state: 'visible', timeout: 5000 })
}

async function resetSplash(page) {
  await page.evaluate(() => {
    sessionStorage.clear()
    localStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })
  await waitIdle(page)
}

async function capture(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'allow' })
}

async function exerciseViewport(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage()
  const consoleMessages = []
  const pageErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') consoleMessages.push(`${msg.type()}: ${msg.text()}`)
  })
  page.on('pageerror', err => pageErrors.push(String(err)))

  const startUrl = `${BASE}/?pr57=1`
  await page.goto(startUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => { sessionStorage.clear(); localStorage.clear() })
  await page.reload({ waitUntil: 'networkidle' })

  const root = page.getByRole('button', { name: 'Enter Red Tide PPC' })
  const focusedOnMount = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || '')
  if (focusedOnMount !== 'Enter Red Tide PPC') throw new Error(`${vp.name}: splash did not focus on mount`)

  await page.waitForSelector('.tide-experience--idle', { state: 'attached', timeout: 5000 })
  const idleStart = Date.now()
  const framePaths = {}
  let front10 = null
  let front20 = null

  for (const mark of idleMarks) {
    const elapsed = Date.now() - idleStart
    await page.waitForTimeout(Math.max(0, mark - elapsed))
    const present = await page.locator('.tide-intro').count() === 1
    if (!present) throw new Error(`${vp.name}: splash disappeared at idle + ${mark}ms`)
    const name = `${vp.name}_idle_${String(mark).padStart(5, '0')}ms`
    await capture(page, name)
    framePaths[mark] = `${name}.png`
    if (mark === 10000) {
      front10 = await page.locator('.tide-intro__wave-layer--front svg').screenshot()
      await fs.writeFile(`${OUT}/${vp.name}_front_period_a.png`, front10)
    }
  }

  // One full horizontal period for the front layer is exactly 10s.
  const elapsed20 = Date.now() - idleStart
  await page.waitForTimeout(Math.max(0, 20000 - elapsed20))
  front20 = await page.locator('.tide-intro__wave-layer--front svg').screenshot()
  await fs.writeFile(`${OUT}/${vp.name}_front_period_b.png`, front20)
  const seam = comparePng(front10, front20)

  const idleAt30 = await page.locator('.tide-intro').count() === 1

  const beforeClick = await page.locator('.tide-intro__curtain').evaluate(el => getComputedStyle(el).animationName)
  if (!beforeClick) throw new Error(`${vp.name}: curtain animation metadata missing`)

  await root.click({ position: { x: Math.round(vp.width / 2), y: Math.round(vp.height / 2) } })
  const exitFrames = {}
  for (const mark of [100, 400, 800]) {
    await page.waitForTimeout(mark - (Date.now() - (idleStart + 30000)))
  }
  // The loop above would be timing-sensitive; capture from the actual click timestamp below.
  const clickAt = Date.now()
  await resetSplash(page)
  const root2 = page.getByRole('button', { name: 'Enter Red Tide PPC' })
  await root2.click({ position: { x: Math.round(vp.width / 2), y: Math.round(vp.height / 2) } })
  const clickStart = Date.now()
  for (const mark of [100, 400, 800]) {
    await page.waitForTimeout(Math.max(0, mark - (Date.now() - clickStart)))
    const name = `${vp.name}_exit_${String(mark).padStart(4, '0')}ms`
    await capture(page, name)
    exitFrames[mark] = `${name}.png`
    if (mark === 400) {
      const handoff = await page.evaluate(() => {
        const intro = document.querySelector('.tide-intro__title')
        const landing = document.querySelector('h1[aria-label="Red Tide"]')
        const visible = (el) => {
          if (!el) return false
          const cs = getComputedStyle(el)
          return cs.visibility !== 'hidden' && Number.parseFloat(cs.opacity || '1') > 0.01
        }
        const curtain = document.querySelector('.tide-intro__curtain')
        const surface = document.querySelector('.tide-intro__surface')
        return {
          introVisible: visible(intro),
          landingVisible: visible(landing),
          introCount: document.querySelectorAll('.tide-intro__title').length,
          landingCount: document.querySelectorAll('h1[aria-label="Red Tide"]').length,
          curtainY: curtain ? csY(curtain) : null,
          surfaceY: surface ? csY(surface) : null,
        }
        function csY(el) {
          const t = getComputedStyle(el).transform
          const m = t.match(/^matrix3?\((.+)\)$/)
          if (!m) return 0
          const p = m[1].split(',').map(Number)
          return t.startsWith('matrix3d') ? p[13] : p[5]
        }
      })
      if (handoff.introVisible === handoff.landingVisible) {
        throw new Error(`${vp.name}: handoff visibility overlap at 400ms`)
      }
      if (handoff.curtainY === null || handoff.surfaceY === null || Math.abs(handoff.curtainY - handoff.surfaceY) > 1.5) {
        throw new Error(`${vp.name}: surface/curtain Y drift at 400ms: ${handoff.curtainY} vs ${handoff.surfaceY}`)
      }
    }
  }

  const detached = await page.waitForSelector('.tide-intro', { state: 'detached', timeout: 5000 }).then(() => true).catch(() => false)
  const visibleRedTideAfter = await page.locator('h1[aria-label="Red Tide"]:visible').count()
  if (!detached) {
    throw new Error(`${vp.name}: exit was not observed within 5s`)
  }
  if (visibleRedTideAfter !== 1) {
    throw new Error(`${vp.name}: expected exactly one visible landing RED TIDE after exit, got ${visibleRedTideAfter}`)
  }

  // Keyboard validation.
  for (const key of ['Enter', ' ', 'Escape']) {
    await resetSplash(page)
    const keyboardRoot = page.getByRole('button', { name: 'Enter Red Tide PPC' })
    await keyboardRoot.focus()
    const scrollBefore = await page.evaluate(() => window.scrollY)
    await page.keyboard.press(key === ' ' ? 'Space' : key)
    if (key === ' ' && (await page.evaluate(() => window.scrollY)) !== scrollBefore) {
      throw new Error(`${vp.name}: Space changed scroll position`)
    }
    const leaving = await page.locator('.tide-experience--leaving').count()
    if (leaving !== 1) throw new Error(`${vp.name}: ${key} did not start exit`)
  }

  // Visibility pause/resume validation.
  await resetSplash(page)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const paused = await page.locator('.tide-intro--hidden').count() === 1
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const resumed = await page.locator('.tide-intro--hidden').count() === 0
  if (!paused || !resumed) throw new Error(`${vp.name}: visibility pause/resume failed`)

  // No app console errors/warnings.
  if (consoleMessages.length || pageErrors.length) {
    throw new Error(`${vp.name}: console/page errors: ${JSON.stringify({ consoleMessages, pageErrors })}`)
  }

  results.push({
    viewport: vp.name,
    idleAt30,
    seam,
    exitObserved: detached,
    exitFrames,
    idleFrames: framePaths,
    focusedOnMount,
    consoleMessages,
    pageErrors,
  })
  await context.close()
}

async function measureCost(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.goto(`${BASE}/?pr57-cost=1`, { waitUntil: 'networkidle' })
  await page.evaluate(() => { sessionStorage.clear(); localStorage.clear() })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('.tide-experience--idle', { state: 'attached', timeout: 5000 })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  await page.evaluate(() => {
    window.__pr57LongTasks = []
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__pr57LongTasks.push(entry.duration)
    }).observe({ entryTypes: ['longtask'] })
  })
  const before = await cdp.send('Performance.getMetrics')
  await page.waitForTimeout(10000)
  const after = await cdp.send('Performance.getMetrics')
  const metric = (payload, name) => Number(payload.metrics.find(m => m.name === name)?.value ?? 0)
  const taskDelta = metric(after, 'TaskDuration') - metric(before, 'TaskDuration')
  const scriptDelta = metric(after, 'ScriptDuration') - metric(before, 'ScriptDuration')
  const layoutDelta = metric(after, 'LayoutCount') - metric(before, 'LayoutCount')
  const recalcDelta = metric(after, 'RecalcStyleCount') - metric(before, 'RecalcStyleCount')
  const framesDelta = metric(after, 'Frames') - metric(before, 'Frames')
  const longTasks = await page.evaluate(() => window.__pr57LongTasks || [])
  await fs.writeFile(`${OUT}/cpu-cost.json`, JSON.stringify({
    sampleSeconds: 10,
    taskDurationSeconds: taskDelta,
    approximateMainThreadPercent: taskDelta / 10 * 100,
    scriptDurationSeconds: scriptDelta,
    layoutCountDelta: layoutDelta,
    recalcStyleCountDelta: recalcDelta,
    framesDelta,
    longTaskCount: longTasks.length,
    maxLongTaskMs: Math.max(0, ...longTasks),
  }, null, 2))
  await context.close()
}

await fs.writeFile(`${OUT}/run-metadata.json`, JSON.stringify({
  commitSha: process.env.GITHUB_SHA || 'unknown',
  viewports,
  idleMarks,
  frontPeriodMs: 10000,
  exitMs: 800,
}, null, 2))

const browser = await chromium.launch({ headless: true })
try {
  for (const vp of viewports) await exerciseViewport(browser, vp)
  await measureCost(browser)
} finally {
  await browser.close()
}

await fs.writeFile(`${OUT}/results.json`, JSON.stringify(results, null, 2))
console.log(JSON.stringify({ results }, null, 2))
