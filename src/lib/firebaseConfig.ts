export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  messagingSenderId: string
  appId: string
}

const FIELDS = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
} as const

const PLACEHOLDERS = new Set([
  'AIza...', 'your-project.firebaseapp.com', 'your-project',
  '000000000000', '1:000000000000:web:0000000000000000',
])

/** Shared browser/build check; accepts the same values as the existing bootstrap. */
export function checkFirebaseConfig(env: Record<string, unknown>) {
  const config = {} as FirebaseConfig
  const missingVariables: string[] = []
  for (const [field, variable] of Object.entries(FIELDS)) {
    const raw = env[variable]
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (!value || PLACEHOLDERS.has(value)) missingVariables.push(variable)
    config[field as keyof FirebaseConfig] = value
  }
  return { config: missingVariables.length ? null : config, missingVariables }
}

/** Opt-in only: presence does not prove credentials work or that demo is disabled. */
export function requireFirebaseBuildConfig(env: Record<string, unknown>): void {
  if (typeof env.VITE_REQUIRE_FIREBASE !== 'string' ||
      env.VITE_REQUIRE_FIREBASE.trim().toLowerCase() !== 'true') return
  const { missingVariables } = checkFirebaseConfig(env)
  if (missingVariables.length) {
    throw new Error(`VITE_REQUIRE_FIREBASE=true: missing, blank or placeholder Firebase variables: ${missingVariables.join(', ')}. Supply these build-time variables or unset VITE_REQUIRE_FIREBASE for a sample-data build.`)
  }
}
