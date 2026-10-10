import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

/**
 * Firebase bootstrap.
 *
 * The web config below is PUBLIC by design — it ships in the browser bundle.
 * It is an identifier, not a secret. Access control lives entirely in
 * `firestore.rules`.
 */

export { checkFirebaseConfig } from './firebaseConfig'
import { checkFirebaseConfig, type FirebaseConfig } from './firebaseConfig'
export type { FirebaseConfig } from './firebaseConfig'

const rawEnv = import.meta.env as Record<string, string | undefined>

/** Returns null for missing, blank or placeholder values, as before. */
export function readFirebaseConfig(): FirebaseConfig | null {
  return checkFirebaseConfig(rawEnv).config
}

/** Set `VITE_USE_DEMO_BACKEND=true` to force demo mode even with keys present. */
export function isDemoModeForced(): boolean {
  return rawEnv.VITE_USE_DEMO_BACKEND?.trim().toLowerCase() === 'true'
}

const config = readFirebaseConfig()

/** True when a complete, non-placeholder Firebase config is available. */
export const hasFirebaseConfig: boolean = config !== null && !isDemoModeForced()

let appInstance: FirebaseApp | null = null
let dbInstance: Firestore | null = null

function app(): FirebaseApp {
  if (!appInstance) {
    if (!config) {
      throw new Error(
        'Firebase is not configured. Copy .env.example to .env and fill in your project keys.',
      )
    }
    appInstance = initializeApp(config)
  }
  return appInstance
}

export function firestore(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(app())
  return dbInstance
}
