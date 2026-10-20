import { checkFirebaseConfig } from '../src/lib/firebaseConfig.js'

/** Only browser identifiers may leave this endpoint. Never return process.env. */
export function clientConfiguration(env: Record<string, unknown>) {
  const { config } = checkFirebaseConfig(env)
  const forcedDemo = String(env.VITE_USE_DEMO_BACKEND ?? '').trim().toLowerCase() === 'true'
  if (!config || forcedDemo) return null
  return {
    version: 1,
    dataset: 'community-v1',
    firebase: config,
    photos: {
      cloudName: typeof env.VITE_CLOUDINARY_CLOUD_NAME === 'string' ? env.VITE_CLOUDINARY_CLOUD_NAME.trim() : '',
      uploadPreset: typeof env.VITE_CLOUDINARY_UPLOAD_PRESET === 'string' ? env.VITE_CLOUDINARY_UPLOAD_PRESET.trim() : '',
    },
  }
}

export function handleClientConfig(request: Request, env: Record<string, unknown>): Response {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET' } })
  const config = clientConfiguration(env)
  return Response.json(config ?? { error: 'Shared reporting is not configured on this site.' }, { status: config ? 200 : 503, headers })
}
