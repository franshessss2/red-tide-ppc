// Test-only Chromium acceptance against the actual packaged Windows app.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const profile = await mkdtemp(join(tmpdir(), 'rtp-visual-'))
const output = join(root, '.cache/visual-review')
await mkdir(output, { recursive: true })
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
let app
try {
  app = await electron.launch({ executablePath: join(root, 'desktop-app/release/win-unpacked/RedTide ppc.exe'), args: [`--user-data-dir=${profile}`], env })
  // The packaged protocol/session is used unchanged. An offscreen test window
  // supplies compositor frames without putting a window on the user's desktop.
  const newWindow = app.waitForEvent('window')
  const offscreenId = await app.evaluate(async ({ BrowserWindow }) => {
    const originals = BrowserWindow.getAllWindows()
    for (const original of originals) { original.on('show', () => original.hide()); original.hide() }
    const window = new BrowserWindow({ show: false, width: 1440, height: 900,
      webPreferences: { offscreen: true, backgroundThrottling: false, sandbox: true, contextIsolation: true, nodeIntegration: false } })
    await window.loadURL('rtp://app/')
    return window.id
  })
  const page = await newWindow
  const capture = async name => {
    await page.evaluate(() => document.fonts.ready)
    // Electron's native capture supports hidden windows without waiting for a
    // foreground compositor frame. This does not measure real GPU smoothness.
    const png = await app.evaluate(async ({ BrowserWindow }, id) => {
      const window = BrowserWindow.fromId(id)
      const image = await Promise.race([
        window.capturePage(undefined, { stayHidden: true, stayAwake: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Offscreen capture did not produce a frame in 15 seconds')), 15000)),
      ])
      if (image.isEmpty()) throw new Error('Offscreen capture is empty')
      return image.toPNG().toString('base64')
    }, offscreenId)
    await writeFile(join(output, name), Buffer.from(png, 'base64'))
  }
  const errors = []
  const writes = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push({ method: request.method(), url: new URL(request.url()).pathname }) })
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.setItem('red-tide-ppc:intro:v3', 'seen'))
  const results = []
  for (const width of [360, 390, 768, 1440]) {
    await app.evaluate(({ BrowserWindow }, { id, width }) => BrowserWindow.fromId(id).setContentSize(width, 900), { id: offscreenId, width })
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('rtp://app/')
    await page.getByText('Sample data', { exact: true }).first().waitFor()
    assert.equal(await page.locator('.coastal-steps').getAttribute('data-motion'), 'enabled')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    assert.equal(overflow, false, `Landing overflow at ${width}`)
    if (width >= 640) {
      const replay = await page.getByRole('button', { name: 'Watch introduction' }).boundingBox()
      assert.equal(replay.width, 44, 'Replay width matches adjacent controls')
      assert.equal(replay.height, 44, 'Replay glyph must not stretch the header')
      assert.equal((await page.getByRole('link', { name: 'Map', exact: true }).boundingBox()).height, replay.height)
    }
    if (width < 640) {
      const trigger = page.getByRole('button', { name: 'More options' })
      assert.equal(await page.locator('.landing-nav__panel').isVisible(), false)
      for (const control of [trigger, page.getByRole('button', { name: 'Android app download QR code' }), page.getByRole('link', { name: 'Map', exact: true })]) {
        const box = await control.boundingBox()
        assert.ok(box.width >= 44 && box.height >= 44)
      }
      await trigger.click()
      await page.getByRole('link', { name: 'Admin', exact: true }).waitFor({ state: 'visible' })
      await page.keyboard.press('Escape')
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
      assert.equal(await trigger.evaluate(node => node === document.activeElement), true)
    }
    await page.getByRole('button', { name: 'Android app download QR code' }).click()
    const qr = page.getByRole('img', { name: /QR code for/ })
    assert.equal(await qr.isVisible(), width >= 640)
    await page.getByRole('link', { name: /Open download folder/ }).waitFor({ state: 'visible' })
    await page.keyboard.press('Escape')
    await capture(`landing-${width}.png`)
    await page.locator('.coastal-steps').scrollIntoViewIfNeeded()
    // Sample actual painted SVG styles over time, beyond the one-off entrance.
    // Each card can be outside the viewport on a phone, so visit it separately.
    for (const selector of ['.coastal-step__pulse', '.coastal-step__send', '.coastal-step__orbit']) {
      const detail = page.locator(selector)
      await detail.scrollIntoViewIfNeeded()
      await page.waitForFunction(selector => document.querySelector(selector).closest('.coastal-step__art').dataset.running === 'true', selector)
      const before = await detail.evaluate(node => {
        const style = getComputedStyle(node)
        return [style.transform, style.opacity, style.strokeDashoffset].join('|')
      })
      await page.waitForFunction(({ selector, before }) => {
        const style = getComputedStyle(document.querySelector(selector))
        return [style.transform, style.opacity, style.strokeDashoffset].join('|') !== before
      }, { selector, before }, { timeout: 6000 })
    }
    await capture(`steps-${width}.png`)
    if (width < 640) {
      await page.getByRole('heading', { name: 'Red Tide', exact: true }).scrollIntoViewIfNeeded()
      await page.waitForFunction(() => [...document.querySelectorAll('.coastal-step__art')].every(node => node.dataset.running === 'false'))
      assert.equal(await page.locator('.coastal-step__orbit').evaluate(node => getComputedStyle(node).animationPlayState), 'paused')
    }
    await page.getByRole('link', { name: /Open the map/ }).click()
    await page.getByTestId('zoom-controls').waitFor()
    assert.equal(await page.getByTestId('advisory-drawer').count(), 0)
    if (width < 768) {
      await page.getByRole('button', { name: /7 zones · 0 flagged/ }).click()
      await page.waitForFunction(() => document.querySelector('.mobile-map-panel')?.getBoundingClientRect().height >= Math.min(innerHeight * .55, 480) - 1)
      const first = page.locator('.mobile-map-panel li button').first()
      await first.waitFor()
      const box = await first.boundingBox()
      assert.ok(box.y < 900, 'First zone starts in the expanded viewport')
      await page.getByRole('button', { name: 'Expand panel' }).click()
      await page.getByRole('heading', { name: 'Coastal zones', exact: true }).waitFor()
    }
    await capture(`map-${width}.png`)
    results.push({ width, landingOverflow: overflow, mobileControlsAtLeast44: width < 640 ? true : null, qrVisibleByDefault: width >= 640, duplicateCountDrawer: false })
  }
  await page.goto('rtp://app/')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.locator('.coastal-steps[data-motion="static"]').waitFor()
  assert.equal(await page.locator('.coastal-step__orbit').evaluate(node => getComputedStyle(node).animationName), 'none')
  await capture('landing-reduced-motion.png')
  await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).setContentSize(390, 844), offscreenId)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'More options' }).click()
  const replay = page.getByRole('button', { name: 'Watch introduction' })
  await replay.click()
  await page.getByRole('button', { name: 'Explore Red Tide' }).click()
  await page.getByRole('dialog', { name: 'Introduction', exact: true }).waitFor({ state: 'hidden' })
  assert.equal(await replay.evaluate(node => node === document.activeElement), true, 'Introduction returns focus to visible replay control')
  await page.keyboard.press('Escape')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.context().addInitScript(() => {
    const connection = new EventTarget()
    Object.defineProperty(connection, 'saveData', { value: true })
    Object.defineProperty(navigator, 'connection', { value: connection, configurable: true })
  })
  await page.reload()
  await page.locator('.landing-surface[data-save-data="true"]').waitFor()
  await page.locator('.coastal-steps[data-motion="static"]').waitFor()
  assert.equal(await page.locator('.coastal-step__orbit').evaluate(node => getComputedStyle(node).animationName), 'none')
  assert.deepEqual(errors, [])
  assert.deepEqual(writes, [])
  const report = { results, reducedMotion: 'static', saveData: 'static', introReplayFocusReturn: true, pageErrors: errors, httpWrites: writes, realPhoneAndGpu: 'not verified' }
  await writeFile(join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  await app?.close()
  assert.equal(dirname(profile), tmpdir())
  assert.ok(profile.startsWith(join(tmpdir(), 'rtp-visual-')))
  await rm(profile, { recursive: true, force: true })
}
