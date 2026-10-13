// Test-only launcher, excluded from the installer. Never imports fixture data
// into the renderer, changes the Team flag or exposes a renderer test bridge.
const { app } = require('electron')
app.setPath('userData', process.argv.at(-1))
app.commandLine.appendSwitch('disable-background-timer-throttling')
const { startDesktop } = require('../src/app.cjs')
startDesktop({ show: false }).catch(error => { console.error(error); app.exit(1) })
