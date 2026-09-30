import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'

const PORT = 4173
const OUT = 'qa/pr56'
const FRAMES = [300, 700, 1000, 2000, 2200, 2500, 2900]
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const fail = message => { throw new Error(message) }
const assert = (value, message) => { if (!value) fail(message) }

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

async function capture(name, width, height) {
  const context = await browser.newContext({ viewport: { width, height } })
  await context.addInitScript(() => {
    sessionStorage.removeItem('red-tide-ppc:splash:v1')
  })
  const page = await context.newPage()
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
  const started = await page.evaluate(() => performance.now())

  await fs.mkdir(OUT + '/' + name, { recursive: true })
  const frames = []
  for (const target of FRAMES) {
    const elapsed = await page.evaluate(start => performance.now() - start, started)
    await page.waitForTimeout(Math.max(0, target - elapsed))
    await page.screenshot({ path: OUT + '/' + name + '/intro-' + target + 'ms.png' })
    const state = await page.evaluate(targetValue => {
      const visible = node => {
        if (!node) return false
        const style = getComputedStyle(node)
        const box = node.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0
      }
      const intro = document.querySelector('.tide-intro')
      const center = document.querySelector('.tide-intro__center')
      return {
        target: targetValue,
        introMounted: Boolean(intro),
        leaving: Boolean(document.querySelector('.tide-intro--leaving')),
        skipButtons: [...document.querySelectorAll('button')].filter(button => /skip intro/i.test(button.textContent || '')).length,
        coreNodes: document.querySelectorAll('.tide-intro__core, .tide-intro__orbit, [data-intro-core]').length,
        corePseudo: center ? getComputedStyle(center, '::after').content : 'none',
        visibleHeadlines: [...document.querySelectorAll('h1[aria-label="Red Tide"], .tide-intro__title[aria-label="Red Tide"]')].filter(visible).length,
      }
    }, target)
    frames.push(state)
  }

  const handoff = frames.find(frame => frame.target === 2200)
  assert(handoff?.leaving || frames.find(frame => frame.target === 2500)?.leaving || false, name + ': exit state not observed in timed frames')
  assert(frames.every(frame => frame.skipButtons === 0), name + ': Skip intro button present')
  assert(frames.every(frame => frame.coreNodes === 0 && (frame.corePseudo === 'none' || frame.corePseudo === 'normal')), name + ': center dot/core present')
  assert(frames.filter(frame => frame.target >= 2200).every(frame => frame.visibleHeadlines === 1), name + ': duplicate visible RED TIDE at handoff')
  await page.waitForTimeout(300)
  assert(await page.locator('.tide-intro').count() === 0, name + ': intro still mounted after exit')
  assert(await page.locator('h1[aria-label="Red Tide"]').count() === 1, name + ': landing headline count is not one')
  assert(errors.length === 0, name + ': console errors/warnings: ' + errors.join(' | '))

  console.log(JSON.stringify({
    name,
    width,
    height,
    frameTimes: FRAMES,
    exitObserved: Boolean(handoff?.leaving || frames.find(frame => frame.target === 2500)?.leaving),
    frameMeta: frames,
  }))
  await context.close()
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  await waitServer()
  await capture('390x844', 390, 844)
  await capture('360x740', 360, 740)
  await capture('1440x900', 1440, 900)
  console.log('PR56 browser verification: PASS')
} finally {
  await browser.close()
  server.kill('SIGTERM')
}
