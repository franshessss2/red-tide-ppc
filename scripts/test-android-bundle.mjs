// Test-only: real Chromium through the already-installed desktop Electron.
// This checks extracted APK web assets, not Android hardware/WebView behavior.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'
import { assertAndroidAssets, currentPasscode, inventory } from './native-apps.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apk = join(root, 'android-app/android/app/build/outputs/apk/debug/app-debug.apk')
assert.ok(process.env.JAVA_HOME, 'JAVA_HOME must identify the existing JDK.')
const temporary = await mkdtemp(join(tmpdir(), 'rtp-apk-check-'))
const webRoot = join(temporary, 'assets/public')
const jar = join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'jar.exe' : 'jar')
let application
let server
try {
  execFileSync(jar, ['xf', apk, 'assets/public'], { cwd: temporary, windowsHide: true })
  const expected = await inventory(join(root, 'dist'))
  assertAndroidAssets(expected, await inventory(webRoot))
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2' }
  server = createServer(async (request, response) => {
    try {
      const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      const spa = ['/', '/map', '/admin', '/devices'].includes(route)
      const file = resolve(webRoot, spa ? 'index.html' : '.' + route)
      if (!file.startsWith(webRoot + sep)) { response.writeHead(403).end(); return }
      const bytes = await readFile(file)
      response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(bytes)
    } catch { response.writeHead(404).end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}/admin`
  const launcher = join(temporary, 'launcher.cjs')
  await writeFile(launcher, `const { app, BrowserWindow } = require('electron');
app.setPath('userData', ${JSON.stringify(join(temporary, 'profile'))});
app.whenReady().then(() => {
  const window = new BrowserWindow({show:false, webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true}});
  window.loadURL(${JSON.stringify(url)});
});
`)
  const desktopRequire = createRequire(join(root, 'desktop-app/package.json'))
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  application = await electron.launch({ executablePath: desktopRequire('electron'), args: [launcher], env })
  const context = application.context()
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort())
  const page = await application.firstWindow()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.setItem('red-tide-ppc:intro:v3', 'seen'))
  await page.reload()
  const passcode = await currentPasscode(root)
  await page.getByLabel('Passcode').fill('137950FrT')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await page.getByText('That passcode is not correct.').waitFor()
  await page.getByLabel('Passcode').fill(passcode)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await page.getByLabel('Passcode').waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => sessionStorage.getItem('red-tide-ppc:admin-unlocked')), '1')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ apk, verifiedWebFiles: Object.keys(expected).length,
    currentAdminPasscodeVerified: true, oldPasscodeRejected: true, pageErrors: errors,
    note: 'Real Chromium against extracted APK assets. Android hardware and WebView remain unverified.' }, null, 2))
} finally {
  if (application) await application.close()
  if (server) await new Promise(resolve => server.close(resolve))
  assert.equal(dirname(temporary), tmpdir())
  assert.ok(temporary.startsWith(join(tmpdir(), 'rtp-apk-check-')))
  await rm(temporary, { recursive: true, force: true })
}
