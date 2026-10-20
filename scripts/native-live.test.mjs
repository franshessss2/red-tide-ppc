import assert from 'node:assert/strict'
import { test, mock } from 'node:test'
import { liveNativeEnvironment, readLiveConfiguration } from './native-live.mjs'

const config = () => ({ version: 1, dataset: 'community-v1', firebase: { projectId: 'red-tide-ppc', apiKey: 'synthetic-browser-id',
  authDomain: 'red-tide-ppc.firebaseapp.com', messagingSenderId: '123456789012', appId: '1:123456789012:web:synthetic' },
  photos: { cloudName: 'synthetic-cloud', uploadPreset: 'synthetic-unsigned-preset' } })
test('live release uses only the hosted browser configuration and cannot inherit demo/passcode settings', () => {
  const env = liveNativeEnvironment({ PATH: 'original', VITE_USE_DEMO_BACKEND: 'true', VITE_ADMIN_PASSCODE: 'stale',
    VITE_FIREBASE_API_KEY: 'stale', VITE_PRIVATE_SECRET: 'must-not-ship' }, config())
  assert.equal(env.PATH, 'original')
  assert.equal(env.VITE_FIREBASE_API_KEY, config().firebase.apiKey)
  assert.equal(env.VITE_USE_DEMO_BACKEND, 'false')
  assert.equal(env.VITE_REQUIRE_FIREBASE, 'true')
  assert.equal(env.VITE_NATIVE_APP, 'true')
  assert.equal(env.VITE_ADMIN_PASSCODE, undefined)
  assert.equal(env.VITE_PRIVATE_SECRET, undefined)
})
test('incomplete or wrong-project live configurations fail instead of producing a demo release', () => {
  for (const doc of [null, { ...config(), dataset: 'legacy' }, { ...config(), version: 2 }, { ...config(), firebase: { ...config().firebase, projectId: 'other' } },
    { ...config(), firebase: { ...config().firebase, apiKey: '' } }]) assert.throws(() => liveNativeEnvironment({}, doc))
})
test('unavailable, redirected or insecure configuration never falls back', async () => {
  const network = mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 503 }))
  try {
    await assert.rejects(readLiveConfiguration(), /No demo release was built/)
    for (const url of ['http://example.test/api/client-config', 'https://user:pass@example.test/config', 'https://example.test/config?token=x']) {
      await assert.rejects(readLiveConfiguration(url), /HTTPS URL/)
    }
    assert.equal(network.mock.calls.length, 1)
  } finally { network.mock.restore() }
})
test('records a digest and source for the validated public configuration', async () => {
  const network = mock.method(globalThis, 'fetch', async () => Response.json(config()))
  try {
    const result = await readLiveConfiguration()
    assert.equal(result.document.firebase.projectId, 'red-tide-ppc')
    assert.match(result.configSha256, /^[a-f0-9]{64}$/)
    assert.equal(result.source, 'https://red-tide-ppc.vercel.app/api/client-config')
    assert.equal(network.mock.calls[0].arguments[1].redirect, 'error')
  } finally { network.mock.restore() }
})
