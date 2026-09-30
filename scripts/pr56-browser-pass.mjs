import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

const PORT = 4173
const ROOT = path.resolve('qa/pr56')
const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT)], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
server.stdout.on('data', chunk => process.stdout.write('[server] ' + chunk))
server.stderr.on('data', chunk => process.stderr.write('[server:err] ' + chunk))

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const ms = value => value.endsWith('ms') ? Number.parseFloat(value) : value.endsWith('s') ? Number.parseFloat(value) * 1000 : Number.NaN

async function waitForServer() {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/`)
      if (response.ok) return
    } catch {}
    await sleep(150)
  }
  throw new Error('Vite demo server did not become ready within 15s')
}

async function waitForApp(page) {
  await waitForServer()
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tide-intro', { state: 'visible', timeout: 5000 })
}

async function animationMetadata(page) {
  return page.evaluate(() => {
    const center = document.querySelector('.tide-intro__center')
    const title = document.querySelector('.tide-intro__title span')
    const eyebrow = document.querySelector('.tide-intro__eyebrow')
    const marker = eyebrow && getComputedStyle(eyebrow, '::before')
    const pseudo = (el, pseudo) => el ? getComputedStyle(el, pseudo) : null
    const val = s => s ? ({
      name: s.animationName,
      duration: s.animationDuration,
      delay: s.animationDelay,
      timing: s.animationTimingFunction,
    }) : null
    return {
      orbit: val(pseudo(center, '::before')),
      core: val(pseudo(center, '::after')),
      word: val(getComputedStyle(title)),
      eyebrow: val(getComputedStyle(eyebrow)),
      marker: marker ? {
        name: marker.animationName,
        duration: marker.animationDuration,
        delay: marker.animationDelay,
        timing: marker.animationTimingFunction,
      } : null,
      introHeight: document.querySelector('.tide-intro')?.getBoundingClientRect().height ?? 0,
      curtainHeight: document.querySelector('.tide-intro__curtain')?.getBoundingClientRect().height ?? 0,
    }
  })
}

async function sampleExit(page, dir, viewport) {
  await page.waitForSelector('h1[aria-label="Red Tide"]', { state: 'attached', timeout: 2000 })
  await page.waitForTimeout(2150)
  await page.waitForSelector('.tide-intro--leaving', { state: 'attached', timeout: 1000 })
  await page.waitForTimeout(20)

  const base = await page.evaluate(() => {
    const curtain = document.querySelector('.tide-intro__curtain')
    const surface = document.querySelector('.tide-intro__surface')
    const intro = document.querySelector('.tide-intro')
    const heading = document.querySelector('h1[aria-label="Red Tide"]')
    const rect = heading.getBoundingClientRect()
    const animations = document.querySelector('.tide-intro__title')?.getAnimations().map(a => a.effect?.getTiming())
    return {
      curtainTop: curtain.getBoundingClientRect().top,
      surfaceTop: surface.getBoundingClientRect().top,
      introHeight: intro.getBoundingClientRect().height,
      headingVisibility: getComputedStyle(heading).visibility,
      landingHeadingRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      handoff: document.querySelector('.tide-intro')?.getAttribute('data-handoff'),
      titleAnimations: animations,
    }
  })

  const frames = []
  await fs.mkdir(path.join(ROOT, dir), { recursive: true })

  for (let i = 0; i <= 7; i++) {
    const elapsed = i * 100
    await page.screenshot({ path: path.join(ROOT, dir, `exit-${String(i).padStart(2, '0')}-${elapsed}ms.png`), fullPage: true })
    const state = await page.evaluate(() => {
      const curtain = document.querySelector('.tide-intro__curtain')
      const surface = document.querySelector('.tide-intro__surface')
      const heading = document.querySelector('h1[aria-label="Red Tide"]')
      return {
        curtainTop: curtain?.getBoundingClientRect().top ?? 0,
        surfaceTop: surface?.getBoundingClientRect().top ?? 0,
        dialog: Boolean(document.querySelector('.tide-intro')),
        headingVisibility: heading ? getComputedStyle(heading).visibility : 'missing',
        bodyBg: getComputedStyle(document.body).backgroundColor,
      }
    })
    frames.push({ elapsed, ...state })
    if (i < 7) await page.waitForTimeout(100)
  }

  const c0 = base.curtainTop
  const s0 = base.surfaceTop
  const liveFrames = frames.filter(frame => frame.dialog)
  const diffs = liveFrames.map(f => Math.abs((f.curtainTop - c0) - (f.surfaceTop - s0)))
  const maxDrift = Math.max(...diffs)
  await page.waitForTimeout(120)
  assert(await page.locator('.tide-intro').count() === 0, 'intro did not finish after synchronized exit')
  const endRect = await page.locator('h1[aria-label="Red Tide"]').boundingBox()
  assert(endRect, 'landing heading missing after exit')
  const rectDelta = {
    left: endRect.x - base.landingHeadingRect.left,
    top: endRect.y - base.landingHeadingRect.top,
    width: endRect.width - base.landingHeadingRect.width,
    height: endRect.height - base.landingHeadingRect.height,
  }
  console.log(JSON.stringify({ viewport, landingHeadlineRectBase: base.landingHeadingRect, landingHeadlineRectEnd: endRect, rectDelta }))
  assert(Math.abs(rectDelta.left) < 1 &&
    Math.abs(rectDelta.top) < 1 &&
    Math.abs(rectDelta.width) < 1 &&
    Math.abs(rectDelta.height) < 1,
    `landing headline moved or resized during handoff: ${JSON.stringify(rectDelta)}`)
  assert(await page.locator('h1[aria-label="Red Tide"]').count() === 1, 'landing headline double-rendered')

  // Warm-up must be complete before exit ends: landing hero backdrop has its WebGL
  // canvas mounted after its existing 1.2s idle gate, while Waves is always mounted.
  const warm = await page.evaluate(() => ({
    heroCanvas: document.querySelector('[data-testid="hero-backdrop"] canvas')?.toDataURL?.().length ?? 0,
    heroBackdrop: Boolean(document.querySelector('[data-testid="hero-backdrop"]')),
    canvases: document.querySelectorAll('canvas').length,
  }))

  const result = {
    viewport,
    intro: {
      base,
      maxSurfaceCurtainDriftPx: maxDrift,
      finalHeadingVisible: frames.at(-1)?.headingVisibility,
      bodyBackgrounds: [...new Set(frames.map(f => f.bodyBg))],
    },
    warm,
    frames,
  }
  await fs.writeFile(path.join(ROOT, dir, 'result.json'), JSON.stringify(result, null, 2))

  assert(maxDrift < 2, `surface/curtain drift exceeded 2px: ${maxDrift}`)
  assert(warm.heroBackdrop, 'hero backdrop is not mounted under splash')
  assert(warm.canvases >= 2, `expected Waves + HeroBackdrop canvases, found ${warm.canvases}`)
  assert(result.intro.finalHeadingVisible === 'visible', `landing heading visibility at end: ${result.intro.finalHeadingVisible}`)
}

async function cleanVisit(page, viewport, reducedMotion = 'no-preference') {
  await page.setViewportSize(viewport)
  await page.emulateMedia({ reducedMotion })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  for (const { name, width, height } of [
    { name: '390x844', width: 390, height: 844 },
    { name: '1440x900', width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport: { width, height } })
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    const logs = []
    const gpuWarnings = []
    page.on('console', msg => {
      if (msg.type() !== 'error' && msg.type() !== 'warning') return
      if (msg.text().startsWith('[.WebGL-')) gpuWarnings.push(msg.text())
      else logs.push(`${msg.type()}: ${msg.text()}`)
    })
    page.on('pageerror', err => logs.push(`pageerror: ${err.message}`))

    await waitForApp(page)
    const meta = await animationMetadata(page)
    console.log(JSON.stringify({ viewport: name, meta }))

    assert(meta.orbit.name.includes('tide-orbit-in') && ms(meta.orbit.duration) === 520 && ms(meta.orbit.delay) === 140, 'orbit timing mismatch')
    assert(meta.core.name.includes('tide-core-in') && ms(meta.core.duration) === 200 && ms(meta.core.delay) === 400, 'core timing mismatch')
    assert(meta.word.name.includes('tide-word-in') && ms(meta.word.duration.split(',')[0].trim()) === 500 && ms(meta.word.delay.split(',')[0].trim()) === 500, 'wordmark timing mismatch')
    assert(meta.eyebrow.name.includes('tide-copy-in') && ms(meta.eyebrow.duration) === 380 && ms(meta.eyebrow.delay) === 950, 'copy timing mismatch')
    assert(meta.marker.name.includes('tide-marker-in') && ms(meta.marker.duration) === 360 && ms(meta.marker.delay) === 900, 'marker timing mismatch')
    assert(Math.abs(meta.introHeight - height) < 2, `intro height mismatch at ${name}: ${meta.introHeight}`)

    await sampleExit(page, name, { width, height })
    console.log(JSON.stringify({ viewport: name, chromiumGpuWarnings: gpuWarnings.length }))
    assert(logs.length === 0, `application console warnings/errors on ${name}: ${logs.join(' | ')}`)
    await context.close()
  }

  // Unit/reference audit at 360x740: intro and curtain share the same
  // dynamic viewport reference, and both exit animations use 115dvh.
  {
    const c = await browser.newContext({ viewport: { width: 360, height: 740 } })
    const p = await c.newPage()
    await p.emulateMedia({ reducedMotion: 'no-preference' })
    await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
    const audit = await p.evaluate(() => {
      const intro = document.querySelector('.tide-intro')
      const curtain = document.querySelector('.tide-intro__curtain')
      const surface = document.querySelector('.tide-intro__surface')
      return {
        introHeight: intro?.getBoundingClientRect().height ?? 0,
        curtainHeight: curtain?.getBoundingClientRect().height ?? 0,
        curtainAnimation: getComputedStyle(curtain, '::before').animationName,
        surfaceAnimation: getComputedStyle(surface).animationName,
        curtainBox: curtain?.getBoundingClientRect().height ?? 0,
      }
    })
    console.log(JSON.stringify({ unitAudit: '360x740', audit }))
    assert(Math.abs(audit.introHeight - 740) < 2, `360x740 intro height mismatch: ${audit.introHeight}`)
    assert(Math.abs(audit.curtainHeight - 740) < 2, `360x740 curtain height mismatch: ${audit.curtainHeight}`)
    await c.close()
  }

  // Behavior suite at 390x844.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const logs = []
  const gpuWarnings = []
  page.on('console', msg => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return
    if (msg.text().startsWith('[.WebGL-')) gpuWarnings.push(msg.text())
    else logs.push(`${msg.type()}: ${msg.text()}`)
  })
  page.on('pageerror', err => logs.push(`pageerror: ${err.message}`))

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const storageKey = 'red-tide:intro:v1'
  assert(await page.evaluate(key => sessionStorage.getItem(key), storageKey) === 'seen', `expected sessionStorage ${storageKey}=seen`)

  await page.reload({ waitUntil: 'domcontentloaded' })
  assert(await page.locator('.tide-intro').count() === 0, 'intro replayed after same-session refresh')

  for (const t of [300, 1200, 2500]) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const p = await c.newPage()
    await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(t)
    if (await p.locator('.tide-intro').count()) await p.getByRole('button', { name: /Skip intro/ }).click()
    assert(await p.locator('.tide-intro').count() === 0, `skip failed at ${t}ms`)
    await c.close()
  }

  for (const t of [300, 1200, 2500]) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const p = await c.newPage()
    await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(t)
    if (await p.locator('.tide-intro').count()) await p.keyboard.press('Escape')
    assert(await p.locator('.tide-intro').count() === 0, `Escape failed at ${t}ms`)
    await c.close()
  }

  const replayContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const replayPage = await replayContext.newPage()
  await replayPage.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
  await replayPage.waitForTimeout(300)
  await replayPage.getByRole('button', { name: /Skip intro/ }).click()
  await replayPage.getByRole('button', { name: /Replay intro/ }).click()
  assert(await replayPage.locator('.tide-intro').count() === 1, 'replay did not remount exactly one intro')
  await replayPage.getByRole('button', { name: /Skip intro/ }).click()
  assert(await replayPage.locator('.tide-intro').count() === 0, 'replay/skip left overlay mounted')
  await replayContext.close()

  const reduceContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const reducePage = await reduceContext.newPage()
  await reducePage.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
  assert(await reducePage.locator('.tide-intro').count() === 0, 'reduced-motion intro mounted')
  assert(await reducePage.getByRole('link', { name: /Open the map/i }).count() === 1, 'landing missing under reduced motion')
  await reduceContext.close()

  const rapidContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const rapidPage = await rapidContext.newPage()
  await rapidPage.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
  await rapidPage.waitForTimeout(250)
  for (let i = 0; i < 3; i++) {
    if (await rapidPage.locator('.tide-intro').count()) await rapidPage.getByRole('button', { name: /Skip intro/ }).click()
    if (await rapidPage.getByRole('button', { name: /Replay intro/ }).count()) await rapidPage.getByRole('button', { name: /Replay intro/ }).click()
    await rapidPage.keyboard.press('Escape')
  }
  await rapidPage.waitForTimeout(400)
  assert(await rapidPage.locator('.tide-intro').count() === 0, 'rapid skip/escape/replay left intro stuck')
  await rapidContext.close()

  console.log(JSON.stringify({ behaviorSuiteChromiumGpuWarnings: gpuWarnings.length }))
  assert(logs.length === 0, `application console warnings/errors during behavior suite: ${logs.join(' | ')}`)
  await context.close()
  console.log('PR56 browser verification: PASS')
} finally {
  await browser.close()
  server.kill('SIGTERM')
}
