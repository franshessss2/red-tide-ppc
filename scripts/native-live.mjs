import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const fields = { apiKey: 'VITE_FIREBASE_API_KEY', authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID', messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID', appId: 'VITE_FIREBASE_APP_ID' }

/** The website supplies the same public configuration used by its own bundle.
 * No service account, admin password or arbitrary ambient VITE_ value is copied. */
export function liveNativeEnvironment(environment, document) {
  assert.equal(document?.version, 1, 'Unsupported public configuration version.')
  assert.equal(document.dataset, 'community-v1', 'Refusing legacy or unknown test datasets.')
  assert.equal(document.firebase?.projectId, 'red-tide-ppc', 'Refusing a different Firebase project.')
  const cleaned = Object.fromEntries(Object.entries(environment).filter(([key]) => !key.startsWith('VITE_')))
  for (const [field, variable] of Object.entries(fields)) {
    const value = document.firebase?.[field]
    assert.ok(typeof value === 'string' && value.trim() && !value.includes('PRIVATE KEY') && value !== 'AIza...', `Missing public Firebase field: ${field}`)
    cleaned[variable] = value.trim()
  }
  for (const [field, variable] of [['cloudName', 'VITE_CLOUDINARY_CLOUD_NAME'], ['uploadPreset', 'VITE_CLOUDINARY_UPLOAD_PRESET']]) {
    const value = document.photos?.[field]
    if (typeof value === 'string' && value.trim()) cleaned[variable] = value.trim()
  }
  return { ...cleaned, VITE_USE_DEMO_BACKEND: 'false', VITE_REQUIRE_FIREBASE: 'true', VITE_NATIVE_APP: 'true' }
}

export async function readLiveConfiguration(value = 'https://red-tide-ppc.vercel.app/api/client-config') {
  const url = new URL(value)
  assert.ok(url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search,
    'Public configuration must use an HTTPS URL without credentials or query strings.')
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' })
  assert.ok(response.ok, `Hosted shared-reporting configuration is unavailable (HTTP ${response.status}). No demo release was built.`)
  const document = await response.json()
  // Validate before a version bump or any native build mutation.
  liveNativeEnvironment({}, document)
  return { document, source: url.href, configSha256: createHash('sha256').update(JSON.stringify(document)).digest('hex') }
}
