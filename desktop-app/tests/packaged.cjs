const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const { _electron: electron } = createRequire(path.join(__dirname, '..', '..', 'package.json'))('playwright')

async function run() {
  const executable = process.argv[2] || path.join(__dirname, '..', 'release', 'win-unpacked', 'RedTide ppc.exe')
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'rtp-packaged-'))
  const env = { ...process.env }
  const live = process.argv.includes('--live')
  delete env.ELECTRON_RUN_AS_NODE
  let application
  try {
    application = await electron.launch({ executablePath: executable, args: [`--user-data-dir=${profile}`], env })
    await application.evaluate(({ BrowserWindow }) => {
      // Suppress the visible window during this test; normal entrypoint and
      // packaged runtime are retained. No GPU screenshot is claimed here.
      for (const window of BrowserWindow.getAllWindows()) { window.on('show', () => window.hide()); window.hide() }
    })
    const actual = await application.evaluate(({ app }) => ({ name: app.getName(), version: app.getVersion(), packaged: app.isPackaged, profile: app.getPath('userData') }))
    assert.equal(actual.name, 'RedTide ppc')
    assert.equal(actual.version, require('../package.json').version)
    assert.equal(actual.packaged, true)
    assert.equal(actual.profile, profile)
    const page = await application.firstWindow()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => localStorage.setItem('red-tide-ppc:intro:v3', 'seen'))
    await page.reload()
    await page.getByRole('link', { name: /Open the map/ }).waitFor()
    const result = await page.evaluate(async () => {
      const check = async (url, headers) => {
        const response = await fetch(url, { headers })
        return { status: response.status, type: response.headers.get('content-type'), bytes: (await response.arrayBuffer()).byteLength }
      }
      return { secure: window.isSecureContext, node: typeof window.require,
        sampleLabel: document.body.innerText.includes('Sample data'),
        mapRoute: await check('/map'), film: await check('/media/opening-peak.mp4', { Range: 'bytes=0-31' }),
        qr: await check('/media/android/red-tide-download-qr.svg'), sketch: await check('/red_tide_combined.ino') }
    })
    assert.equal(result.secure, true); assert.equal(result.node, 'undefined')
    assert.equal(result.sampleLabel, !live); assert.equal(result.mapRoute.status, 200)
    assert.equal(result.film.status, 206); assert.equal(result.film.bytes, 32)
    assert.equal(result.qr.status, 200); assert.equal(result.sketch.status, 200)
    // Exercise the real bundled gate in an isolated profile. Do not submit or
    // approve reports; only sample-mode access is tested.
    const source = await fs.readFile(path.join(__dirname, '../../src/lib/demoAdminPasscode.ts'), 'utf8')
    const passcode = source.match(/export const DEMO_ADMIN_PASSCODE = '([^']+)'/)[1]
    await page.goto('rtp://app/admin')
    if (live) {
      const link = page.getByRole('link', { name: 'Open secure Admin' })
      await link.waitFor()
      assert.equal(await link.getAttribute('href'), 'https://red-tide-ppc.vercel.app/admin')
      assert.equal(await page.getByLabel('Passcode').count(), 0)
      result.hostedAdminVerified = true
      console.log(JSON.stringify({ executable, ...actual, ...result }, null, 2))
      return
    }
    await page.getByLabel('Passcode').fill('137950FrT')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await page.getByText('That passcode is not correct.').waitFor()
    await page.getByLabel('Passcode').fill(passcode)
    await page.getByRole('button', { name: 'Unlock' }).click()
    await page.getByLabel('Passcode').waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => sessionStorage.getItem('red-tide-ppc:admin-unlocked')), '1')
    result.currentAdminPasscodeVerified = true
    result.oldAdminPasscodeRejected = true
    console.log(JSON.stringify({ executable, ...actual, ...result }, null, 2))
  } finally {
    if (application) await application.close()
    if (path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('rtp-packaged-')) await fs.rm(profile, { recursive: true, force: true })
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
