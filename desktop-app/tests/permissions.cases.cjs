// Node-native cases use a separate filename pattern from the root Vitest suite.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { configurePermissions } = require('../src/permissions.cjs')

function fixture(responses = [2]) {
  const session = new EventEmitter()
  session.setPermissionCheckHandler = fn => { session.check = fn }
  session.setPermissionRequestHandler = fn => { session.request = fn }
  session.setDevicePermissionHandler = fn => { session.device = fn }
  let url = 'rtp://app/arduino.html'
  const contents = { getURL: () => url }
  const window = { webContents: contents }
  const dialogs = []
  const clear = configurePermissions(session, () => window, { showMessageBox: async (_window, options) => {
    dialogs.push(options)
    const next = responses.shift()
    if (next instanceof Error) throw next
    return { response: next ?? 2 }
  } })
  async function select(ports) {
    const event = { preventDefault() {} }
    return new Promise(resolve => session.emit('select-serial-port', event, ports, contents, resolve))
  }
  return { session, contents, dialogs, clear, select, navigate: value => { url = value } }
}
const A = { portId: 'synthetic-a', portName: 'TEST-COM-A', vendorId: 'test-vendor', productId: 'test-product', serialNumber: 'test-a' }
const B = { ...A, portId: 'synthetic-b', portName: 'TEST-COM-B', serialNumber: 'test-b' }

test('one port still requires consent; cancellation/rejected prompt leaves no grant', async () => {
  for (const choice of [2, new Error('synthetic dialog failure')]) {
    const f = fixture([choice])
    assert.equal(await f.select([A]), '')
    assert.equal(f.dialogs.length, 1)
    assert.equal(f.dialogs[0].defaultId, 2)
    assert.equal(f.session.device({ deviceType: 'serial', origin: 'rtp://app', device: A }), false)
  }
})

test('selection grants only the chosen device; navigation, revocation and cleanup deny it', async () => {
  const f = fixture([1, 0])
  assert.equal(await f.select([A, B]), B.portId)
  const permission = device => f.session.device({ deviceType: 'serial', origin: 'rtp://app', device })
  assert.equal(permission(A), false)
  assert.equal(permission(B), true)
  f.navigate('rtp://app/map')
  assert.equal(permission(B), false)
  f.navigate('rtp://app/arduino.html')
  f.session.emit('serial-port-revoked', {}, { device: B })
  assert.equal(permission(B), false)
  f.clear()
  assert.equal(permission(B), false)
})

test('foreign frames, other routes and unrelated permissions are denied', async () => {
  const f = fixture()
  assert.equal(f.session.check(f.contents, 'serial', 'rtp://app', { isMainFrame: true, requestingUrl: 'rtp://app/arduino.html' }), true)
  assert.equal(f.session.check(f.contents, 'serial', 'https://evil.example', {}), false)
  assert.equal(f.session.check(f.contents, 'serial', 'rtp://app', { isMainFrame: false }), false)
  for (const permission of ['geolocation', 'media', 'usb', 'hid', 'notifications']) assert.equal(f.session.check(f.contents, permission, 'rtp://app', {}), false)
  f.navigate('rtp://app/admin')
  assert.equal(await f.select([A]), '')
  assert.equal(f.dialogs.length, 0)
  assert.equal(f.session.listenerCount('serial-port-removed'), 0)
})

test('unplugged port cannot be granted after the dialog opens', async () => {
  const f = fixture([0])
  f.session.removeAllListeners('serial-port-added')
  const pending = f.select([A])
  f.session.emit('serial-port-removed', {}, A)
  assert.equal(await pending, '')
  assert.equal(f.session.listenerCount('serial-port-removed'), 0)
})
