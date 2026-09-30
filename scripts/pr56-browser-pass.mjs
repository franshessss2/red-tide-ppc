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

async function boot(page) {
  await waitServer()
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tide-intro', { state: 'visible', timeout: 5000 })
}

function visibleRedTides(page) {
  return page.evaluate(() => {
    const visible = node => {
      if (!node) return false
      const style = getComputedStyle(node)
      const box = node.getBoundingClientRect()
      return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0
    }
    return [...document.querySelectorAll('h1[aria-label="Red Tide"], .tide-intro__title[aria-label="Red Tide"]')].filter(visible).length
  })
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
      word: val(title ? getComputedStyle(title) : null),
      copy: val(eyebrow ? getComputedStyle(eyebrow) : null),
      marker: marker ? val(marker) : null,
      skipButtons: [...document.querySelectorAll('button')].filter(button => /skip intro/i.test(button.textContent || '')).length,
    }
  })
}

async function captureFrames(name, width, height) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
      const text = message.text()
      if (!text.startsWith('[.WebGL-')) errors.push(text)
    }
  })
  page.on('pageerror', error => errors.push('pageerror: ' + error.message))

  await boot(page)
  await page.evaluate(() => sessionStorage.clear())
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tide-intro', { state: 'visible', timeout: 5000 })

  const meta = await inspectIntro(page)
  assert(Math.abs(meta.introHeight - height) < 2 && Math.abs(meta.curtainHeight - height) < 2, name + ': viewport sizing mismatch')
  assert(meta.skipButtons === 0, name + ': Skip intro button still present')
  assert(meta.corePseudo === 'none' || meta.corePseudo === 'normal', name + ': center core pseudo still present')
  assert(meta.acquisition.name.includes('tide-acquisition') && toMs(meta.acquisition.duration) === 300 && toMs(meta.acquisition.delay) === 400, name + ': acquisition timing mismatch')
  assert(meta.word.name.includes('tide-word-in') && toMs(meta.word.duration) === 500 && toMs(meta.word.delay) === 500, name + ': word timing mismatch')
  assert(meta.copy.name.includes('tide-copy-in') && toMs(meta.copy.duration) === 380 && toMs(meta.copy.delay) === 950, name + ': copy timing mismatch')
  assert(meta.marker.name.includes('tide-marker-in') && toMs(meta.marker.duration) === 360 && toMs(meta.marker.delay) === 900, name + ': marker timing mismatch')

  const started = await page.evaluate(() => performance.now())
  const frameMeta = []
  await fs.mkdir(OUT + '/' + name, { recursive: true })

  for (const target of FRAMES) {
    const elapsed = await page.evaluate(start => performance.now() - start, started)
    await page.waitForTimeout(Math.max(0, target - elapsed))
    await page.screenshot({ path: OUT + '/' + name + '/intro-' + target + 'ms.png', fullPage: true })
    const state = await page.evaluate(targetValue => {
      const curtain = document.querySelector('.tide-intro__curtain')
      const surface = document.querySelector('.tide-intro__surface')
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
        curtainTop: curtain ? curtain.getBoundingClientRect().top : null,
        surfaceTop: surface ? surface.getBoundingClientRect().top : null,
        visibleHeadlines,
        skipButtons: [...document.querySelectorAll('button')].filter(button => /skip intro/i.test(button.textContent || '')).length,
      }
    }, target)
    frameMeta.push(state)
    assert(state.skipButtons === 0, name + ': Skip intro appeared at ' + target + 'ms')
    if (target >= 2200) assert(state.visibleHeadlines === 1, name + ': visible RED TIDE count ' + state.visibleHeadlines + ' at ' + target + 'ms')
  }

  const leaveDeadline = Date.now() + 3000
  while (Date.now() < leaveDeadline && !(await page.locator('.tide-intro--leaving').count())) {
    await page.waitForTimeout(10)
  }
  assert(await page.locator('.tide-intro--leaving').count() === 1, name + ': exit state was not observed')

  const base = await page.evaluate(() => {
    const curtain = document.querySelector('.tide-intro__curtain')
    const surface = document.querySelector('.tide-intro__surface')
    return { curtainTop: curtain.getBoundingClientRect().top, surfaceTop: surface.getBoundingClientRect().top }
  })
  let maxDrift = 0
  const exitStart = Date.now()
  while (Date.now() - exitStart <= 760) {
    const sample = await page.evaluate(() => {
      const curtain = document.querySelector('.tide-intro__curtain')
      const surface = document.querySelector('.tide-intro__surface')
      if (!curtain || !surface) return null
      return { curtainTop: curtain.getBoundingClientRect().top, surfaceTop: surface.getBoundingClientRect().top }
    })
    if (sample) {
      maxDrift = Math.max(maxDrift, Math.abs((sample.curtainTop - base.curtainTop) - (sample.surfaceTop - base.surfaceTop)))
    }
    await page.waitForTimeout(25)
  }
  assert(maxDrift < 2, name + ': surface/curtain drift ' + maxDrift + 'px')
  await page.waitForTimeout(120)
  assert(await page.locator('.tide-intro').count() === 0, name + ': intro still mounted after exit')
  assert(await page.locator('h1[aria-label="Red Tide"]').count() === 1, name + ': landing headline double-rendered')
  const landingBox = await page.locator('h1[aria-label="Red Tide"]').boundingBox()
  assert(landingBox && landingBox.width > 0 && landingBox.height > 0, name + ': landing headline missing after exit')
  assert(await page.locator('canvas').count() >= 2, name + ': expected Waves + HeroBackdrop canvases')
  assert(errors.length === 0, name + ': console errors/warnings: ' + errors.join(' | '))
  console.log(JSON.stringify({ name, width, height, frameTimes: FRAMES, exitObserved: true, maxDrift, frameMeta }))
  await context.close()
}

async function behaviorSuite() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
      const text = message.text()
      if (!text.startsWith('[.WebGL-')) errors.push(text)
    }
  })
  page.on('pageerror', error => errors.push('pageerror: ' + error.message))
  await boot(page)
  await page.waitForTimeout(3000)
  assert(await page.evaluate(() => sessionStorage.getItem('red-tide-ppc:splash:v1')) === 'seen', 'sessionStorage splash key was not set')
  await page.reload({ waitUntil: 'domcontentloaded' })
  assert(await page.locator('.tide-intro').count() === 0, 'intro replayed on same-session refresh')

  for (const time of [300, 1200, 2500]) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const p = await c.newPage()
    await boot(p)
    await p.waitForTimeout(time)
    if (await p.locator('.tide-intro').count()) await p.keyboard.press('Escape')
    assert(await p.locator('.tide-intro').count() === 0, 'Escape failed at ' + time + 'ms')
    await c.close()
  }

  const replay = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const rp = await replay.newPage()
  await boot(rp)
  await rp.waitForTimeout(300)
  await rp.keyboard.press('Escape')
  await rp.getByRole('button', { name: /Replay intro/ }).click()
  assert(await rp.locator('.tide-intro').count() === 1, 'replay did not mount one intro')
  await rp.keyboard.press('Escape')
  assert(await rp.locator('.tide-intro').count() === 0, 'replay left intro mounted')
  await replay.close()

  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const rm = await reduced.newPage()
  await boot(rm)
  assert(await rm.locator('.tide-intro').count() === 0, 'reduced-motion intro mounted')
  assert(await rm.getByRole('button', { name: 'Replay intro' }).getAttribute('disabled') !== null, 'reduced-motion replay button is not disabled')
  await reduced.close()

  const rapid = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const rq = await rapid.newPage()
  await boot(rq)
  for (let i = 0; i < 4; i++) {
    await rq.keyboard.press('Escape')
    if (await rq.getByRole('button', { name: /Replay intro/ }).count()) await rq.getByRole('button', { name: /Replay intro/ }).click()
    await rq.waitForTimeout(50)
  }
  assert(await rq.locator('.tide-intro').count() === 0, 'rapid input left overlay mounted')
  await rapid.close()

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
