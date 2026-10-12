const { arduinoUrl, localUrl } = require('./policy.cjs')

function serialKey(device) {
  if (!device?.portName) return null
  return JSON.stringify([device.portName, device.vendorId, device.productId, device.serialNumber])
}

function configurePermissions(session, getWindow, dialog) {
  const grants = new Set()
  let choosing = false
  function serialRequest(contents, origin, details = {}) {
    return contents === getWindow()?.webContents && arduinoUrl(contents?.getURL()) &&
      Boolean(localUrl(origin)) && details.isMainFrame !== false &&
      (!details.requestingUrl || arduinoUrl(details.requestingUrl))
  }
  session.setPermissionCheckHandler((contents, permission, origin, details) =>
    permission === 'serial' && serialRequest(contents, origin, details))
  // Serial port selection itself supplies the native consent dialog. Other
  // capabilities (including location, camera, mic, HID and generic USB) are denied.
  session.setPermissionRequestHandler((contents, permission, callback, details = {}) =>
    callback(permission === 'serial' && serialRequest(contents, details.requestingUrl || contents?.getURL(), details)))
  session.setDevicePermissionHandler(details => details.deviceType === 'serial' &&
    arduinoUrl(getWindow()?.webContents.getURL()) && Boolean(localUrl(details.origin)) &&
    Boolean(serialKey(details.device)) && grants.has(serialKey(details.device)))

  session.on('select-serial-port', async (event, ports, contents, callback) => {
    event.preventDefault()
    if (choosing || !serialRequest(contents, contents.getURL())) { callback(''); return }
    choosing = true
    const available = new Set(ports.map(port => port.portId))
    const removed = (_event, port) => available.delete(port.portId)
    session.on('serial-port-removed', removed)
    try {
      if (!ports.length) {
        await dialog.showMessageBox(getWindow(), { type: 'info', title: 'RedTide ppc — Arduino', message: 'No serial ports found.', detail: 'Connect your board, close Arduino Serial Monitor, then try Connect USB again.' })
        callback('')
        return
      }
      // One device is never silently selected. Each listed port requires Connect;
      // Next port cycles the snapshot, and Cancel is always the default action.
      let index = 0
      while (true) {
        const port = ports[index]
        const choice = await dialog.showMessageBox(getWindow(), {
          type: 'question', title: 'RedTide ppc — Connect Arduino USB',
          message: `Connect to ${port.displayName || port.portName}?`,
          detail: `Port ${port.portName} (${index + 1} of ${ports.length}). Select only your demonstration board. You can cancel and reconnect after plugging in a different board.`,
          buttons: ['Connect', 'Next port', 'Cancel'], defaultId: 2, cancelId: 2, noLink: true,
        })
        if (!serialRequest(contents, contents.getURL())) { callback(''); break }
        if (choice.response === 1) { index = (index + 1) % ports.length; continue }
        if (choice.response !== 0 || !available.has(port.portId)) { callback(''); break }
        grants.add(serialKey(port))
        callback(port.portId)
        break
      }
    } catch { callback('') }
    finally { choosing = false; session.removeListener('serial-port-removed', removed) }
  })
  session.on('serial-port-revoked', (_event, details) => grants.delete(serialKey(details.device)))
  return () => grants.clear()
}

module.exports = { configurePermissions }
