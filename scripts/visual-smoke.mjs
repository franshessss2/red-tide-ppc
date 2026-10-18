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
  await app.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) { window.on('show', () => window.hide()); window.hide() } })
  const page = await app.firstWindow()
  const errors = []
  const writes = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push({ method: request.method(), url: new URL(request.url()).pathname }) })
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.setItem('red-tide-ppc:intro:v3', 'seen'))
  const results = []
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('rtp://app/')
    await page.getByText('Sample data', { exact: true }).first().waitFor()
    assert.equal(await page.locator('.coastal-steps').getAttribute('data-motion'), 'enabled')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    assert.equal(overflow, false, `Landing overflow at ${width}`)
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
    await page.screenshot({ path: join(output, `landing-${width}.png`) })
    await page.locator('.coastal-steps').scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(output, `steps-${width}.png`) })
    await page.getByRole('link', { name: /Open the map/ }).click()
    await page.getByTestId('zoom-controls').waitFor()
    assert.equal(await page.getByTestId('advisory-drawer').count(), 0)
    if (width < 768) {
      await page.getByRole('button', { name: /7 zones · 0 flagged/ }).click()
      const first = page.locator('.mobile-map-panel li button').first()
      await first.waitFor()
      const box = await first.boundingBox()
      assert.ok(box.y < 900, 'First zone starts in the expanded viewport')
      await page.getByRole('button', { name: 'Expand panel' }).click()
      await page.getByRole('heading', { name: 'Coastal zones', exact: true }).waitFor()
    }
    await page.screenshot({ path: join(output, `map-${width}.png`) })
    results.push({ width, landingOverflow: overflow, mobileControlsAtLeast44: width < 640 ? true : null, qrVisibleByDefault: width >= 640, duplicateCountDrawer: false })
  }
  await page.goto('rtp://app/')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.locator('.coastal-steps[data-motion="static"]').waitFor()
  await page.screenshot({ path: join(output, 'landing-reduced-motion.png') })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.context().addInitScript(() => {
    const connection = new EventTarget()
    Object.defineProperty(connection, 'saveData', { value: true })
    Object.defineProperty(navigator, 'connection', { value: connection, configurable: true })
  })
  await page.reload()
  await page.locator('.landing-surface[data-save-data="true"]').waitFor()
  await page.locator('.coastal-steps[data-motion="static"]').waitFor()
  assert.deepEqual(errors, [])
  assert.deepEqual(writes, [])
  const report = { results, reducedMotion: 'static', saveData: 'static', pageErrors: errors, httpWrites: writes, realPhoneAndGpu: 'not verified' }
  await writeFile(join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  await app?.close()
  assert.equal(dirname(profile), tmpdir())
  assert.ok(profile.startsWith(join(tmpdir(), 'rtp-visual-')))
  await rm(profile, { recursive: true, force: true })
}
