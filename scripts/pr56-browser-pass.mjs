import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'

const PORT = 4173
const OUT = 'qa/pr56'
const FRAMES = [300, 700, 1000, 2000, 2200, 2500, 2900]
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const fail = message => { throw new Error(message) }
const assert = (value, message) => { if (!value) fail(message) }
const toMs = value => value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000

const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] })
server.stdout.on('data', data => process.stdout.write('[server] ' + data))
server.stderr.on('data', data => process.stderr.write('[server:err] ' + data))

async function waitServer() {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:' + PORT + '/')
      if (response.ok) return
    } catch {}
    await sleep(100)
  }
  fail('Vite preview server did not become ready')
}

async function freshPage(viewport, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion })
  await context.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('__pr56FreshContext')) {
        sessionStorage.removeItem('red-tide-ppc:splash:v1')
        sessionStorage.setItem('__pr56FreshContext', '1')
      }
    } catch {}
    window.__pr56IntroStart = null
    window.__pr56ExitStart = null
    window.__pr56ExitEnd = null
    window.__pr56MaxDrift = 0

    const sampleExit = () => {
      const leaving = document.querySelector('.tide-intro--leaving')
      const curtain = document.querySelector('.tide-intro__curtain')
      const surface = document.querySelector('.tide-intro__surface')
      if (!leaving || !curtain || !surface) return
      if (window.__pr56ExitStart === null) {
        window.__pr56ExitStart = performance.now()
      }
      const baseCurtain = curtain.getBoundingClientRect().top
      const baseSurface = surface.getBoundingClientRect().top
      const sampleAt = window.__pr56ExitStart
      const tick = () => {
        const currentCurtain = document.querySelector('.tide-intro__curtain')
        const currentSurface = document.querySelector('.tide-intro__surface')
        if (!currentCurtain || !currentSurface) return
        const drift = Math.abs(
          (currentCurtain.getBoundingClientRect().top - baseCurtain) -
          (currentSurface.getBoundingClientRect().top - baseSurface),
        )
        window.__pr56MaxDrift = Math.max(window.__pr56MaxDrift, drift)
        const elapsed = performance.now() - sampleAt
        if (elapsed < 800) requestAnimationFrame(tick)
        else window.__pr56ExitEnd = performance.now()
      }
      requestAnimationFrame(tick)
    }

    const markIntro = () => {
      if (window.__pr56IntroStart === null && document.querySelector('.tide-intro')) {
        window.__pr56IntroStart = performance.now()
      }
      if (window.__pr56ExitStart === null && document.querySelector('.tide-intro--leaving')) {
        sampleExit()
      }
    }

    const observe = () => {
      if (!document.documentElement) {
        setTimeout(observe, 0)
        return
      }
      const observer = new MutationObserver(markIntro)
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
      markIntro()
    }
    observe()
  })

  const page = await context.newPage()
  return { context, page }
}

async function inspectIntro(page) {
  return page.evaluate(() => {
    const intro = document.querySelector('.tide-intro')
    const center = document.querySelector('.tide-intro__center')
    const title = document.querySelector('.tide-intro__title span')
    const eyebrow = document.querySelector('.tide-intro__eyebrow')
    const marker = eyebrow ? getComputedStyle(eyebrow, '::before') : null
    const val = style => style ? ({ name: style.animationName, duration: style.animationDuration, delay: style.animationDelay }) : null
    return {
      introHeight: intro ? intro.getBoundingClientRect().height : 0,
      curtainHeight: document.querySelector('.tide-intro__curtain')?.getBoundingClientRect().height || 0,
      acquisition: val(center ? getComputedStyle(center, '::before') : null),
      corePseudo: center ? getComputedStyle(center, '::after').content : 'none',
      legacyCoreNodes: document.querySelectorAll('.tide-intro__core, .tide-intro__orbit, [data-intro-core]').length,
      word: val(title ? getComputedStyle(title) : null),
      copy: val(eyebrow ? getComputedStyle(eyebrow) : null),
      marker: marker ? val(marker) : null,
      skipButtons: [...document.querySelectorAll('button')].filter(button => /skip intro/i.test(button.textContent || '')).length,
    }
  })
}

async function captureFrames(name, width, height) {
  const { context, page } = await freshPage({ width, height })
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
      const text = message.text()
      if (!text.startsWith('[.WebGL-')) errors.push(text)
    }
  })
  page.on('pageerror', error => errors.push('pageerror: ' + error.message))

  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tide-intro', { state: 'visible', timeout: 5000 })

  const meta = await inspectIntro(page)
  assert(Math.abs(meta.introHeight - height) < 2 && Math.abs(meta.curtainHeight - height) < 2, name + ': viewport sizing mismatch')
  assert(meta.skipButtons === 0, name + ': Skip intro button still present')
  assert(meta.legacyCoreNodes === 0, name + ': legacy center core/orbit node still present')
  assert(meta.corePseudo === 'none' || meta.corePseudo === 'normal', name + ': center core pseudo still present')
  assert(meta.acquisition.name.includes('tide-acquisition') && toMs(meta.acquisition.duration) === 300 && toMs(meta.acquisition.delay) === 400, name + ': acquisition timing mismatch')
  assert(meta.word.name.includes('tide-word-in') && toMs(meta.word.duration) === 500 && toMs(meta.word.delay) === 500, name + ': word timing mismatch')
  assert(meta.copy.name.includes('tide-copy-in') && toMs(meta.copy.duration) === 380 && toMs(meta.copy.delay) === 950, name + ': copy timing mismatch')
  assert(meta.marker.name.includes('tide-marker-in') && toMs(meta.marker.duration) === 360 && toMs(meta.marker.delay) === 900, name + ': marker timing mismatch')

  await page.waitForTimeout(3200)
  assert(await page.locator('.tide-intro').count() === 0, name + ': initial intro did not complete before replay setup')

  await page.evaluate(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    const nativeClearTimeout = window.clearTimeout.bind(window)
    const heldTimers = new Map()
    let nextId = 1
    window.__pr56ReleaseHold = () => {
      for (const [id, timer] of heldTimers) {
        nativeSetTimeout(timer.callback, 0, ...timer.args)
        heldTimers.delete(id)
      }
    }
    window.setTimeout = (callback, delay = 0, ...args) => {
      if (delay === 2100) {
        const id = nextId++
        heldTimers.set(id, { callback, args })
        return id
      }
      return nativeSetTimeout(callback, delay, ...args)
    }
    window.clearTimeout = id => {
      if (heldTimers.delete(id)) return
      nativeClearTimeout(id)
    }
  })

  await page.getByRole('button', { name: /Replay intro/ }).click()
  await page.waitForSelector('.tide-intro--playing', { state: 'visible', timeout: 2000 })
  await page.waitForFunction(() => typeof window.__pr56ReleaseHold === 'function', null, { timeout: 1000 })

  const started = await page.evaluate(() => performance.now())
  const frameMeta = []
  await fs.mkdir(OUT + '/' + name, { recursive: true })

  for (const target of FRAMES) {
    if (target === 2200) {
      await page.evaluate(() => window.__pr56ReleaseHold())
    }
    const elapsed = await page.evaluate(start => performance.now() - start, started)
    await page.waitForTimeout(Math.max(0, target - elapsed))
    await page.screenshot({ path: OUT + '/' + name + '/intro-' + target + 'ms.png', fullPage: true })
    const state = await page.evaluate(targetValue => {
      const visible = node => {
        if (!node) return false
        const style = getComputedStyle(node)
        const box = node.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0
      }
      const visibleHeadlines = [...document.querySelectorAll('h1[aria-label="Red Tide"], .tide-intro__title[aria-label="Red Tide"]')].filter(visible).length
      return {
        target: targetValue,
        intro: Boolean(document.querySelector('.tide-intro')),
        leaving: Boolean(document.querySelector('.tide-intro--leaving')),
        visibleHeadlines,
        skipButtons: [...document.querySelectorAll('button')].filter(button => /skip intro/i.test(button.textContent || '')).length,
        coreNodes: document.querySelectorAll('.tide-intro__core, .tide-intro__orbit, [data-intro-core]').length,
      }
    }, target)
    frameMeta.push(state)
    assert(state.skipButtons === 0, name + ': Skip intro appeared at ' + target + 'ms')
    assert(state.coreNodes === 0, name + ': center core/orbit appeared at ' + target + 'ms')
    if (target >= 2200) assert(state.visibleHeadlines === 1, name + ': duplicate visible RED TIDE at ' + target + 'ms')
  }

  const exit = await page.evaluate(() => ({
    exitStart: document.querySelector('.tide-intro--leaving') ? performance.now() : null,
    maxDrift: window.__pr56MaxDrift,
  }))
  if (exit.exitStart === null) {
    await page.waitForSelector('.tide-intro--leaving', { state: 'visible', timeout: 500 })
  }

  const drift = await page.evaluate(() => new Promise(resolve => {
    const intro = document.querySelector('.tide-intro')
    const curtain = document.querySelector('.tide-intro__curtain')
    const surface = document.querySelector('.tide-intro__surface')
    if (!intro || !curtain || !surface) return resolve({ maxDrift: 0 })
    const baseCurtain = curtain.getBoundingClientRect().top
    const baseSurface = surface.getBoundingClientRect().top
    let max = 0
    const end = performance.now() + 780
    const tick = now => {
      const currentCurtain = document.querySelector('.tide-intro__curtain')
      const currentSurface = document.querySelector('.tide-intro__surface')
      if (!currentCurtain || !currentSurface) return resolve({ maxDrift: max })
      max = Math.max(max, Math.abs(
        (currentCurtain.getBoundingClientRect().top - baseCurtain) -
        (currentSurface.getBoundingClientRect().top - baseSurface),
      ))
      if (now >= end) resolve({ maxDrift: max })
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }))
  assert(drift.maxDrift < 2, name + ': surface/curtain drift ' + drift.maxDrift + 'px')
  await page.waitForTimeout(120)
  assert(await page.locator('.tide-intro').count() === 0, name + ': intro still mounted after exit')
  assert(await page.locator('h1[aria-label="Red Tide"]').count() === 1, name + ': landing headline double-rendered')
  assert(errors.length === 0, name + ': console errors/warnings: ' + errors.join(' | '))

  console.log(JSON.stringify({ name, width, height, frameTimes: FRAMES, exitObserved: true, maxDrift: drift.maxDrift, frameMeta }))
  await context.close()
}

async function behaviorSuite() {
  const { context, page } = await freshPage({ width: 390, height: 844 })
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
      const text = message.text()
      if (!text.startsWith('[.WebGL-')) errors.push(text)
    }
  })
  page.on('pageerror', error => errors.push('pageerror: ' + error.message))
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tide-intro', { state: 'visible', timeout: 5000 })
  await page.waitForTimeout(3200)
  assert(await page.evaluate(() => sessionStorage.getItem('red-tide-ppc:splash:v1')) === 'seen', 'sessionStorage splash key was not set')
  await page.reload({ waitUntil: 'domcontentloaded' })
  assert(await page.locator('.tide-intro').count() === 0, 'intro replayed on same-session refresh')

  for (const time of [300, 1200, 2500]) {
    const { context: c, page: p } = await freshPage({ width: 390, height: 844 })
    await p.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.tide-intro--playing', { state: 'visible', timeout: 5000 })
    await p.waitForTimeout(time)
    await p.keyboard.press('Escape')
    assert(await p.locator('.tide-intro').count() === 0, 'Escape failed at ' + time + 'ms')
    await c.close()
  }

  const { context: replayContext, page: replayPage } = await freshPage({ width: 390, height: 844 })
  await replayPage.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded' })
  await replayPage.waitForSelector('.tide-intro', { state: 'visible', timeout: 5000 })
  await replayPage.keyboard.press('Escape')
  await replayPage.getByRole('button', { name: /Replay intro/ }).click()
  assert(await replayPage.locator('.tide-intro').count() === 1, 'replay did not mount intro')
  await replayPage.keyboard.press('Escape')
  assert(await replayPage.locator('.tide-intro').count() === 0, 'replay Escape left intro mounted')
  await replayContext.close()

  const { context: reducedContext, page: reducedPage } = await freshPage({ width: 390, height: 844 }, 'reduce')
  await reducedPage.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded' })
  assert(await reducedPage.locator('.tide-intro').count() === 0, 'reduced-motion intro mounted')
  assert(await reducedPage.getByRole('button', { name: 'Intro motion off' }).isDisabled(), 'reduced-motion replay button is not disabled')
  await reducedContext.close()

  assert(errors.length === 0, 'behavior console errors/warnings: ' + errors.join(' | '))
  await context.close()
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  await waitServer()
  await captureFrames('390x844', 390, 844)
  await captureFrames('360x740', 360, 740)
  await captureFrames('1440x900', 1440, 900)
  await behaviorSuite()
  console.log('PR56 browser verification: PASS')
} finally {
  await browser.close()
  server.kill('SIGTERM')
}
