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
const FRONT_PERIOD_MS = 10000
const EXIT_MS = 800
const results = []

await fs.rm(OUT, { recursive: true, force: true })
await fs.mkdir(OUT, { recursive: true })

function comparePngHalves(buffer) {
  const png = PNG.sync.read(buffer)
  if (png.width % 2 !== 0) return { equal: false, differenceRatio: 1, maxDelta: 255 }
  const halfWidth = png.width / 2
  let differingBytes = 0
  let totalBytes = 0
  let maxDelta = 0
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < halfWidth; x++) {
      const a = (y * png.width + x) * 4
      const b = (y * png.width + x + halfWidth) * 4
      for (let channel = 0; channel < 4; channel++) {
        const d = Math.abs(png.data[a + channel] - png.data[b + channel])
        totalBytes++
        if (d !== 0) differingBytes++
        if (d > maxDelta) maxDelta = d
      }
    }
  }
  return {
    equal: differingBytes === 0,
    differingBytes,
    totalBytes,
    differenceRatio: differingBytes / totalBytes,
    maxDelta,
  }
}

function comparePng(a, b) {
  const pa = PNG.sync.read(a)
  const pb = PNG.sync.read(b)
  if (pa.width !== pb.width || pa.height !== pb.height) {
    return { equal: false, differingBytes: -1, totalBytes: -1, maxDelta: 255 }
  }
  let differingBytes = 0
  let maxDelta = 0
  for (let i = 0; i < pa.data.length; i++) {
    const d = Math.abs(pa.data[i] - pb.data[i])
    if (d !== 0) differingBytes++
    if (d > maxDelta) maxDelta = d
  }
  return {
    equal: differingBytes === 0,
    differingBytes,
    totalBytes: pa.data.length,
    differenceRatio: differingBytes / pa.data.length,
    maxDelta,
  }
}

async function clearAndReload(page) {
  await page.evaluate(() => {
    sessionStorage.clear()
    localStorage.clear()
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tide-experience--idle', { state: 'attached', timeout: 6000 })
}

async function capture(page, name) {
  const path = `${OUT}/${name}.png`
  await page.screenshot({ path, animations: 'allow' })
  return path
}

async function computedY(page, selector) {
  return page.locator(selector).evaluate(el => {
    const t = getComputedStyle(el).transform
    const m = t.match(/^matrix3d?\((.+)\)$/)
    if (!m) return 0
    const p = m[1].split(',').map(Number)
    return t.startsWith('matrix3d') ? p[13] : p[5]
  })
}

async function handoffState(page) {
  return page.evaluate(() => {
    const isVisible = (el) => {
      if (!el) return false
      const cs = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return cs.visibility !== 'hidden'
        && Number.parseFloat(cs.opacity || '1') > 0.01
        && rect.width > 0
        && rect.height > 0
    }
    const intro = document.querySelector('.tide-intro__title')
    const landing = document.querySelector('h1[aria-label="Red Tide"]')
    const skipText = [...document.querySelectorAll('button')].filter(b => /skip intro/i.test(b.textContent || ''))
    return {
      introVisible: isVisible(intro),
      landingVisible: isVisible(landing),
      visibleWordmarks: [intro, landing].filter(isVisible).length,
      redTideTextCount: [...document.querySelectorAll('h1[aria-label="Red Tide"], .tide-intro__title')].filter(isVisible).length,
      skipButtons: skipText.length,
    }
  })
}

async function runKeyboardCheck(page, key) {
  await clearAndReload(page)
  const root = page.getByRole('button', { name: 'Enter Red Tide PPC' })
  await root.focus()
  const beforeScroll = await page.evaluate(() => window.scrollY)
  await page.keyboard.press(key === ' ' ? 'Space' : key)
  const afterScroll = await page.evaluate(() => window.scrollY)
  const leaving = await page.locator('.tide-experience--leaving').count()
  return { key, leaving, scrollChanged: afterScroll !== beforeScroll }
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
    if (msg.type() !== 'error' && msg.type() !== 'warning') return
    const text = msg.text()
    const isChromiumGpuDiagnostic =
      msg.type() === 'warning'
      && /\[\.WebGL-[^\]]+\].*GPU stall due to ReadPixels/.test(text)
    if (!isChromiumGpuDiagnostic) {
      consoleMessages.push(`${msg.type()}: ${text}`)
    }
  })
  page.on('pageerror', error => pageErrors.push(String(error)))

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await clearAndReload(page)

  const root = page.getByRole('button', { name: 'Enter Red Tide PPC' })
  const focusedOnMount = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || '')
  if (focusedOnMount !== 'Enter Red Tide PPC') {
    throw new Error(`${vp.name}: splash did not focus on mount`)
  }
  if (await page.locator('button', { hasText: 'Skip intro' }).count()) {
    throw new Error(`${vp.name}: Skip intro button is still present`)
  }

  const idleStart = Date.now()
  const idleFrames = {}
  for (const mark of idleMarks) {
    await page.waitForTimeout(Math.max(0, mark - (Date.now() - idleStart)))
    if (await page.locator('.tide-intro').count() !== 1) {
      throw new Error(`${vp.name}: splash disappeared at idle + ${mark}ms`)
    }
    idleFrames[mark] = await capture(page, `${vp.name}_idle_${String(mark).padStart(5, '0')}ms`)
  }

  const idleAt30 = await page.locator('.tide-intro').count() === 1
  if (!idleAt30) throw new Error(`${vp.name}: splash was not present at 30s`)

  // Seam check: capture the front wave at the beginning and one complete
  // horizontal period later, then verify the actual SVG geometry repeats exactly.
  const allWaveParts = page.locator('.tide-intro__wave-layer, .tide-intro__wave-bob')
  await allWaveParts.evaluateAll(elements => elements.forEach(el => { el.style.animationPlayState = 'paused' }))
  const front = page.locator('.tide-intro__wave-layer--front')
  const seamMeta = await front.evaluate(el => {
    const animation = el.getAnimations().find(a => a.animationName === 'tide-wave-front-x')
    const duration = Number(animation?.effect?.getComputedTiming().duration ?? 0)
    if (!animation || duration !== 10000) throw new Error(`front wave animation missing or wrong duration: ${duration}`)
    animation.currentTime = 0
    return { duration }
  })
  await page.waitForTimeout(40)
  const seamStartFrame = await capture(page, `${vp.name}_seam_start_0000ms`)
  await front.evaluate((el, duration) => {
    const animation = el.getAnimations().find(a => a.animationName === 'tide-wave-front-x')
    if (!animation) throw new Error('front wave animation missing')
    animation.currentTime = duration
  }, seamMeta.duration)
  await page.waitForTimeout(40)
  const seamPeriodFrame = await capture(page, `${vp.name}_seam_period_10000ms`)
  const seamFrameEqual = require('node:buffer').Buffer.equals(seamStartFrame, seamPeriodFrame)
  const seamGeometry = await front.evaluate(el => {
    const stroke = el.querySelector('path[stroke]')
    const gradient = el.querySelector('linearGradient')
    const animation = el.getAnimations().find(a => a.animationName === 'tide-wave-front-x')
    if (!stroke || !gradient || !animation) throw new Error('front wave seam probes missing')
    const totalLength = stroke.getTotalLength()
    const halfLength = totalLength / 2
    const samples = Array.from({ length: 11 }, (_, index) => index / 10).map(t => {
      const a = stroke.getPointAtLength(halfLength * t)
      const b = stroke.getPointAtLength(halfLength + halfLength * t)
      return { dx: b.x - a.x, dy: b.y - a.y }
    })
    return {
      duration: Number(animation.effect?.getComputedTiming().duration ?? 0),
      iterations: animation.effect?.getComputedTiming().iterations,
      gradientUnits: gradient.getAttribute('gradientUnits'),
      spreadMethod: gradient.getAttribute('spreadMethod'),
      gradientX1: gradient.getAttribute('x1'),
      gradientX2: gradient.getAttribute('x2'),
      samples,
    }
  })
  await allWaveParts.evaluateAll(elements => elements.forEach(el => { el.style.removeProperty('animation-play-state') }))
  const periodic = seamGeometry.samples.every(sample => Math.abs(sample.dx - 1000) <= 0.01 && Math.abs(sample.dy) <= 0.01)
  const gradientRepeats = seamGeometry.gradientUnits === 'userSpaceOnUse'
    && seamGeometry.spreadMethod === 'repeat'
    && seamGeometry.gradientX1 === '0'
    && seamGeometry.gradientX2 === '1000'
  const seamMatch = periodic && gradientRepeats && seamGeometry.duration === FRONT_PERIOD_MS && seamFrameEqual
  if (!seamMatch) {
    throw new Error(`${vp.name}: wave seam proof failed: ${JSON.stringify({ seamGeometry, seamFrameEqual })}`)
  }

  await page.waitForTimeout(Math.max(0, 30000 - (Date.now() - idleStart)))

  const exitDurationData = await page.evaluate(() => ({
    curtain: document.querySelector('.tide-intro__curtain')?.getAttribute('data-intro-exit-duration'),
    surface: document.querySelector('.tide-intro__surface')?.getAttribute('data-intro-exit-duration'),
  }))
  if (exitDurationData.curtain !== '800' || exitDurationData.surface !== '800') {
    throw new Error(`${vp.name}: exit duration metadata mismatch ${JSON.stringify(exitDurationData)}`)
  }

  await root.click({ position: { x: Math.floor(vp.width / 2), y: Math.floor(vp.height / 2) } })
  const exitStart = Date.now()
  const exitFrames = {}
  const handoffAt400 = { state: null }
  for (const mark of [100, 400, 800]) {
    await page.waitForTimeout(Math.max(0, mark - (Date.now() - exitStart)))
    exitFrames[mark] = await capture(page, `${vp.name}_exit_${String(mark).padStart(4, '0')}ms`)
    if (mark === 400) {
      handoffAt400.state = await handoffState(page)
      const curtainY = await computedY(page, '.tide-intro__curtain').catch(() => null)
      const surfaceY = await computedY(page, '.tide-intro__surface').catch(() => null)
      handoffAt400.curtainY = curtainY
      handoffAt400.surfaceY = surfaceY
    }
  }

  if (handoffAt400.state.redTideTextCount !== 1 || handoffAt400.state.skipButtons !== 0) {
    throw new Error(`${vp.name}: handoff duplicate/skip state ${JSON.stringify(handoffAt400.state)}`)
  }
  if (handoffAt400.curtainY == null || handoffAt400.surfaceY == null || Math.abs(handoffAt400.curtainY - handoffAt400.surfaceY) > 1.5) {
    throw new Error(`${vp.name}: exit surface/curtain drift ${handoffAt400.curtainY} vs ${handoffAt400.surfaceY}`)
  }

  const detached = await page.waitForSelector('.tide-intro', { state: 'detached', timeout: 5000 }).then(() => true).catch(() => false)
  if (!detached) throw new Error(`${vp.name}: exit was not observed within 5s`)
  const visibleLanding = await page.locator('h1[aria-label="Red Tide"]:visible').count()
  if (visibleLanding !== 1) throw new Error(`${vp.name}: expected exactly one visible landing RED TIDE after exit, got ${visibleLanding}`)

  const keyboard = []
  for (const key of ['Enter', ' ', 'Escape']) {
    keyboard.push(await runKeyboardCheck(page, key))
  }
  if (keyboard.some(x => x.leaving !== 1)) throw new Error(`${vp.name}: keyboard exit failure ${JSON.stringify(keyboard)}`)
  if (keyboard.find(x => x.key === ' ' && x.scrollChanged)) throw new Error(`${vp.name}: Space changed scroll position`)

  await clearAndReload(page)
  const hidden = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    const front = document.querySelector('.tide-intro__wave-layer--front')
    return {
      rootPaused: document.querySelector('.tide-intro')?.classList.contains('tide-intro--hidden'),
      wavePaused: front ? getComputedStyle(front).animationPlayState : null,
    }
  })
  const shown = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  }).then(async () => {
    await page.waitForTimeout(100)
    return page.evaluate(() => {
      const front = document.querySelector('.tide-intro__wave-layer--front')
      const animations = front?.getAnimations().map(animation => animation.playState) ?? []
      return {
        rootPaused: document.querySelector('.tide-intro')?.classList.contains('tide-intro--hidden'),
        wavePaused: front ? getComputedStyle(front).animationPlayState : null,
        animationStates: animations,
      }
    })
  })
  if (!hidden.rootPaused || hidden.wavePaused !== 'paused' || shown.rootPaused || shown.wavePaused !== 'running') {
    throw new Error(`${vp.name}: visibility pause/resume failed ${JSON.stringify({ hidden, shown })}`)
  }

  if (consoleMessages.length || pageErrors.length) {
    throw new Error(`${vp.name}: console/page errors: ${JSON.stringify({ consoleMessages, pageErrors })}`)
  }

  results.push({
    viewport: vp.name,
    idleAt30,
    idleFrames,
    seam,
    seamMatch,
    seamTransformA: transformA,
    seamTransformB: transformB,
    exitFrames,
    exitObserved: detached,
    handoffAt400,
    keyboard,
    visibility: { hidden, shown },
    focusedOnMount,
    consoleMessages,
    pageErrors,
    ignoredChromiumDiagnostics: 'GPU stall due to ReadPixels warnings are headless Chromium diagnostics, not application console output.',
  })
  await context.close()
}

async function measureCost(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await clearAndReload(page)
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
  const taskDuration = metric(after, 'TaskDuration') - metric(before, 'TaskDuration')
  const scriptDuration = metric(after, 'ScriptDuration') - metric(before, 'ScriptDuration')
  const frames = metric(after, 'Frames') - metric(before, 'Frames')
  const longTasks = await page.evaluate(() => window.__pr57LongTasks || [])
  const expectedFrames = 600
  await fs.writeFile(`${OUT}/cpu-cost.json`, JSON.stringify({
    sampleSeconds: 10,
    taskDurationSeconds: taskDuration,
    approximateMainThreadPercent: taskDuration / 10 * 100,
    scriptDurationSeconds: scriptDuration,
    framesDelta: frames,
    expectedFramesAt60Hz: expectedFrames,
    approximateDroppedFrames: Math.max(0, expectedFrames - frames),
    longTaskCount: longTasks.length,
    maxLongTaskMs: Math.max(0, ...longTasks),
  }, null, 2))
  await context.close()
}

await fs.writeFile(`${OUT}/run-metadata.json`, JSON.stringify({
  commitSha: process.env.GITHUB_SHA || 'unknown',
  viewports,
  idleMarks,
  frontPeriodMs: FRONT_PERIOD_MS,
  exitMs: EXIT_MS,
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
