const { app, dialog } = require('electron')
const path = require('node:path')
const { startDesktop } = require('./src/app.cjs')

// A normal desktop profile option supports isolated school rehearsals. It
// changes storage location only, never configuration, flags or permissions.
const profile = process.argv.find(value => value.startsWith('--user-data-dir='))
if (profile) {
  const directory = profile.slice('--user-data-dir='.length)
  if (!path.isAbsolute(directory)) throw new Error('--user-data-dir requires an existing absolute directory.')
  app.setPath('userData', directory)
}

startDesktop().catch(() => {
  dialog.showErrorBox('RedTide ppc', 'RTP could not start. Please reinstall this testing build. Your saved sample records have not been cleared.')
  app.exit(1)
})
