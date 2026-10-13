const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const rootRequire = createRequire(path.join(__dirname, '..', '..', 'package.json'))
const { _electron: electron } = rootRequire('playwright')
const root = path.join(__dirname, '..')

async function run() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'rtp-smoke-'))
  const output = path.join(root, 'test-results')
  await fs.mkdir(output, { recursive: true })
  const result = { routes: [], exceptions: [], note: 'Hidden real Electron; temporary isolated profile; external tiles blocked; no live backend, serial connection or system-browser launch.' }
  let application
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  async function launch() {
    const instance = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, 'launcher.cjs'), profile], env })
    instance.process().stderr.on('data', bytes => process.stderr.write(bytes))
    console.log('RTP smoke: Electron launched', await instance.evaluate(({ app, BrowserWindow }) => ({ name: app.getName(), profile: app.getPath('userData'), windows: BrowserWindow.getAllWindows().length })))
    await instance.context().route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.protocol === 'https:' && /tile\.openstreetmap\.org$|basemaps\.cartocdn\.com$/.test(url.hostname)) return route.abort()
      return route.continue()
    })
    return instance
  }
  try {
    application = await launch()
    let page = await application.firstWindow()
    page.on('pageerror', error => result.exceptions.push(error.message))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => localStorage.setItem('red-tide-ppc:intro:v3', 'seen'))
    await page.reload()
    await page.getByRole('link', { name: /Open the map/ }).waitFor()
    result.window = await application.evaluate(({ app, BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      const preferences = window.webContents.getLastWebPreferences()
      return { name: app.getName(), title: window.getTitle(), nodeIntegration: preferences.nodeIntegration,
        contextIsolation: preferences.contextIsolation, sandbox: preferences.sandbox, webSecurity: preferences.webSecurity }
    })
    assert.equal(result.window.name, 'RedTide ppc')
    assert.equal(result.window.title, 'RedTide ppc')
    assert.equal(result.window.nodeIntegration, false)
    assert.equal(result.window.contextIsolation, true)
    assert.equal(result.window.sandbox, true)
    assert.equal(result.window.webSecurity, true)
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined')
    for (const width of [390, 1280]) {
      await application.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setContentSize(width, 820), width)
      await page.waitForTimeout(250)
      await page.screenshot({ path: path.join(output, `landing-${width}.png`), fullPage: true })
    }
    for (const route of ['/map', '/admin', '/devices', '/arduino.html', '/arduino-demo.html']) {
      await page.goto('rtp://app' + route)
      await page.waitForTimeout(350)
      assert.equal(new URL(page.url()).pathname, route)
      const status = await page.evaluate(async () => (await fetch(location.href)).status)
      assert.equal(status, 200, route)
      const text = await page.locator('body').innerText()
      assert.ok(text.length > 20, route)
      result.routes.push({ route, status, renderedText: text.slice(0, 160) })
      console.log('RTP smoke: route rendered', route)
    }
    assert.equal(await page.evaluate(() => window.isSecureContext && 'serial' in navigator), true)
    await page.goto('rtp://app/')
    await page.getByRole('button', { name: 'Android app download QR code' }).click()
    await page.getByRole('dialog').waitFor()
    const qr = page.getByAltText('QR code for the Red Tide PPC Android download folder')
    await qr.evaluate(image => image.decode())
    result.qrLoaded = true
    await page.getByRole('button', { name: 'Close Android download' }).click()
    result.video = await page.evaluate(async () => {
      const response = await fetch('/media/opening-peak.mp4', { headers: { Range: 'bytes=0-31' } })
      return { status: response.status, type: response.headers.get('content-type'), bytes: (await response.arrayBuffer()).byteLength }
    })
    assert.equal(result.video.status, 206)
    assert.equal(result.video.type, 'video/mp4')
    assert.equal(result.video.bytes, 32)
    result.filmMetadata = await page.evaluate(async () => {
      const video = document.createElement('video')
      video.muted = true; video.preload = 'metadata'
      video.src = '/media/opening-peak.mp4'
      document.body.append(video)
      try {
        return await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Film metadata timed out')), 8000)
          video.onloadedmetadata = () => { clearTimeout(timer); resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight }) }
          video.onerror = () => { clearTimeout(timer); reject(new Error('Film decode failed')) }
        })
      } finally { video.remove() }
    })
    assert.ok(result.filmMetadata.duration > 17 && result.filmMetadata.duration < 20)
    result.deviceApi = await page.evaluate(async () => {
      const response = await fetch('/api/device-readings')
      return { status: response.status, data: await response.json() }
    })
    assert.equal(result.deviceApi.status, 503)
    // This test-only key proves persistence across a real process restart. It is
    // never imported by shipped code and never edits the actual user's records.
    await page.evaluate(() => localStorage.setItem('rtp-test-only-persistence', 'synthetic-persistent-value'))
    await application.close()
    application = await launch()
    page = await application.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    assert.equal(await page.evaluate(() => localStorage.getItem('rtp-test-only-persistence')), 'synthetic-persistent-value')
    result.persistenceAcrossRestart = true
    assert.deepEqual(result.exceptions, [])
    await fs.writeFile(path.join(output, 'smoke.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result, null, 2))
  } finally {
    if (application) await application.close()
    // This fixed prefix was created by mkdtemp above; never remove the user's profile.
    if (path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('rtp-smoke-')) await fs.rm(profile, { recursive: true, force: true })
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
