import { describe, expect, it } from 'vitest'
import { checkFirebaseConfig, requireFirebaseBuildConfig } from './firebaseConfig'

const full = {
  VITE_FIREBASE_API_KEY: 'fixture',
  VITE_FIREBASE_AUTH_DOMAIN: 'fixture.example',
  VITE_FIREBASE_PROJECT_ID: 'fixture',
  VITE_FIREBASE_MESSAGING_SENDER_ID: 'fixture',
  VITE_FIREBASE_APP_ID: 'fixture',
}
const placeholders = {
  VITE_FIREBASE_API_KEY: 'AIza...',
  VITE_FIREBASE_AUTH_DOMAIN: 'your-project.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'your-project',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000',
}

describe('opt-in Firebase build guard', () => {
  it.each([undefined, '', 'false', '0'])('allows absent config when flag is %s', (flag) => {
    expect(() => requireFirebaseBuildConfig({ VITE_REQUIRE_FIREBASE: flag })).not.toThrow()
  })
  it.each(Object.keys(full))('names %s when absent, blank or a placeholder', (key) => {
    for (const value of [undefined, '', '  ', placeholders[key as keyof typeof placeholders]]) {
      const env = { ...full, VITE_REQUIRE_FIREBASE: 'true', [key]: value }
      expect(checkFirebaseConfig(env).missingVariables).toEqual([key])
      expect(() => requireFirebaseBuildConfig(env)).toThrow(key)
    }
  })
  it('reports all invalid variables without their values', () => {
    expect(checkFirebaseConfig(placeholders).missingVariables).toEqual(Object.keys(full))
    try {
      requireFirebaseBuildConfig({ ...placeholders, VITE_REQUIRE_FIREBASE: 'true' })
      throw new Error('guard did not reject placeholders')
    } catch (error) {
      const message = String(error)
      for (const key of Object.keys(full)) expect(message).toContain(key)
      for (const value of Object.values(placeholders)) expect(message).not.toContain(value)
    }
  })
  it('accepts complete trimmed config and preserves explicit demo selection', () => {
    const env = Object.fromEntries(Object.entries(full).map(([key, value]) => [key, ` ${value} `]))
    expect(checkFirebaseConfig(env).config?.apiKey).toBe('fixture')
    expect(() => requireFirebaseBuildConfig({ ...env, VITE_REQUIRE_FIREBASE: ' TRUE ', VITE_USE_DEMO_BACKEND: 'true' })).not.toThrow()
  })
})
