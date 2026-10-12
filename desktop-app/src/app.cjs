const path = require('node:path')
const { app, BrowserWindow, Menu, dialog, protocol, session, shell } = require('electron')
const { SCHEME, APP_URL, localUrl, externalUrl } = require('./policy.cjs')
const { serveAsset } = require('./assets.cjs')
const { configurePermissions } = require('./permissions.cjs')

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true,
} }])
app.setName('RedTide ppc')

async function startDesktop({ show = true } = {}) {
  app.setAppUserModelId('com.redtideppc.desktop')
  if (!app.requestSingleInstanceLock()) { app.quit(); return null }
  let window
  const getWindow = () => window && !window.isDestroyed() ? window : null
  app.on('second-instance', () => {
    const current = getWindow()
    if (!current) return
    if (current.isMinimized()) current.restore()
    current.show(); current.focus()
  })
  await app.whenReady()
  const webRoot = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'web')
  // The app's default session persists under its own userData directory; it
  // shares no cookies or sample records with Helium, the website or Android.
  const persistent = session.defaultSession
  await persistent.protocol.handle(SCHEME, request => serveAsset(webRoot, request))
  const clearSerialGrants = configurePermissions(persistent, getWindow, dialog)
  async function openExternal(value) {
    const safe = externalUrl(value)
    if (safe) {
      try { await shell.openExternal(safe) }
      catch { if (getWindow()) await dialog.showMessageBox(getWindow(), { type: 'info', title: 'RedTide ppc', message: 'The browser could not open this link. Try it in your browser directly.' }) }
    }
  }
  function createWindow() {
    window = new BrowserWindow({
      width: 1280, height: 860, minWidth: 360, minHeight: 480, show: false,
      title: 'RedTide ppc', backgroundColor: '#0b0b09', darkTheme: true,
      icon: path.join(__dirname, '..', 'resources', 'icon.ico'),
      webPreferences: {
        session: persistent, nodeIntegration: false, nodeIntegrationInWorker: false,
        contextIsolation: true, sandbox: true, webSecurity: true,
        allowRunningInsecureContent: false, webviewTag: false, spellcheck: false,
        // Hidden native harnesses need an offscreen surface on Windows. Normal
        // app launches render in the regular visible window.
        offscreen: !show,
      },
    })
    const contents = window.webContents
    contents.on('page-title-updated', event => { event.preventDefault(); getWindow()?.setTitle('RedTide ppc') })
    contents.on('will-attach-webview', event => event.preventDefault())
    contents.on('will-navigate', event => {
      const value = event.url
      if (localUrl(value)) { clearSerialGrants(); return }
      event.preventDefault()
      void openExternal(value)
    })
    contents.on('will-redirect', event => { if (!localUrl(event.url)) event.preventDefault() })
    contents.setWindowOpenHandler(({ url }) => {
      if (localUrl(url)) { clearSerialGrants(); void contents.loadURL(url) }
      else void openExternal(url)
      return { action: 'deny' }
    })
    window.once('ready-to-show', () => { if (show) getWindow()?.show() })
    window.on('closed', clearSerialGrants)
    void window.loadURL(APP_URL)
    return window
  }
  persistent.on('will-download', (event, item) => {
    const url = localUrl(item.getURL())
    if (!url || url.pathname !== '/red_tide_combined.ino') { event.preventDefault(); return }
    item.setSaveDialogOptions({ title: 'Save Arduino sketch', defaultPath: path.join(app.getPath('downloads'), 'red_tide_combined.ino') })
  })
  function navigate(route) {
    const current = getWindow()
    if (current) { clearSerialGrants(); void current.loadURL(APP_URL + route) }
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'RTP', submenu: [
      { label: 'About RedTide ppc', click: () => { if (getWindow()) void dialog.showMessageBox(getWindow(), {
        type: 'info', title: 'RedTide ppc — RTP', message: `RedTide ppc ${app.getVersion()}`,
        detail: 'Windows testing alpha · School community-record prototype. Sample labels identify local demo records. This is not an official BFAR advisory. Maps need internet. Local device rehearsal is available; connected device readings need the hosted site.',
      }) } },
      { type: 'separator' }, { label: 'Home', click: () => navigate('') },
      { label: 'Map', click: () => navigate('map') }, { label: 'Admin', click: () => navigate('admin') },
      { label: 'Arduino USB', click: () => navigate('arduino.html') },
      { label: 'Device rehearsal', click: () => navigate('devices') },
      { type: 'separator' }, { role: 'quit', label: 'Exit RTP' },
    ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen', accelerator: 'F11' }] },
  ]))
  const initial = createWindow()
  app.on('activate', () => { if (!getWindow()) createWindow() })
  app.on('window-all-closed', () => app.quit())
  return initial
}

module.exports = { startDesktop }
