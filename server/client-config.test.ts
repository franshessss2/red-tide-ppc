import { describe, expect, it } from 'vitest'
import { handleClientConfig } from './client-config'

const config = {
  VITE_FIREBASE_API_KEY: 'synthetic-browser-identifier', VITE_FIREBASE_PROJECT_ID: 'red-tide-ppc',
  VITE_FIREBASE_AUTH_DOMAIN: 'red-tide-ppc.firebaseapp.com', VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789012',
  VITE_FIREBASE_APP_ID: '1:123456789012:web:synthetic',
}
describe('public native build configuration', () => {
  it('returns only browser identifiers, never private environment values or the demo passcode', async () => {
    const response = handleClientConfig(new Request('https://example.test/api/client-config'), {
      ...config, GOOGLE_APPLICATION_CREDENTIALS: 'private-path', FIREBASE_PRIVATE_KEY: 'private-key',
      VITE_ADMIN_PASSCODE: 'sample-passcode', OTHER_SECRET: 'private-value',
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ version: 1, dataset: 'community-v1', firebase: {
      apiKey: config.VITE_FIREBASE_API_KEY, projectId: 'red-tide-ppc', authDomain: config.VITE_FIREBASE_AUTH_DOMAIN,
      messagingSenderId: config.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: config.VITE_FIREBASE_APP_ID,
    }, photos: { cloudName: '', uploadPreset: '' } })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('fails closed for incomplete or deliberately local-only sites', () => {
    for (const env of [{}, { ...config, VITE_FIREBASE_API_KEY: '' }, { ...config, VITE_USE_DEMO_BACKEND: 'true' }]) {
      expect(handleClientConfig(new Request('https://example.test/api/client-config'), env).status).toBe(503)
    }
  })
  it('does not accept writes', () => {
    expect(handleClientConfig(new Request('https://example.test/api/client-config', { method: 'POST' }), config).status).toBe(405)
  })
})
