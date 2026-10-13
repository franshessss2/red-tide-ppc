// Reuses the existing project favicon; no new artwork or rasterizer dependency.
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { app, BrowserWindow } = require('electron')
const profile = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'rtp-icons-'))
app.setPath('userData', profile)

app.whenReady().then(async () => {
  const svg = await fs.readFile(path.join(__dirname, '..', '..', 'public', 'favicon.svg'))
  const window = new BrowserWindow({ width: 256, height: 256, useContentSize: true, show: false, frame: false, transparent: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, offscreen: true } })
  const image = 'data:image/svg+xml;base64,' + svg.toString('base64')
  await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><body style="margin:0;background:transparent"><img src="${image}" width="256" height="256"></body></html>`))
  await window.webContents.executeJavaScript('document.images[0].decode()')
  await new Promise(resolve => setTimeout(resolve, 250))
  const bitmap = await window.webContents.capturePage()
  const sizes = [256, 64, 48, 32, 16]
  const images = sizes.map(size => bitmap.resize({ width: size, height: size }).toPNG())
  const header = Buffer.alloc(6 + sizes.length * 16)
  header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  sizes.forEach((size, i) => {
    const entry = 6 + i * 16
    header[entry] = size === 256 ? 0 : size; header[entry + 1] = header[entry]
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(images[i].length, entry + 8); header.writeUInt32LE(offset, entry + 12)
    offset += images[i].length
  })
  const directory = path.join(__dirname, '..', 'resources')
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, 'icon.png'), images[0])
  await fs.writeFile(path.join(directory, 'icon.ico'), Buffer.concat([header, ...images]))
  console.log('Generated RTP PNG/ICO from public/favicon.svg (256, 64, 48, 32, 16 px).')
  window.destroy()
  app.quit()
  // Chromium releases the profile on exit; leave OS-temp cleanup to the OS.
}).catch(error => { console.error(error); app.exit(1) })
