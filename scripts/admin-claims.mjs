// Trusted workstation utility only. Never imported by browser/server routes.
import { applicationDefault, initializeApp, deleteApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { pathToFileURL } from 'node:url'

export function parseRequest(args) {
  const known = new Set(['--project', '--uid', '--email', '--grant', '--revoke', '--apply'])
  const values = {}
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    if (!known.has(flag) || Object.hasOwn(values, flag)) throw new Error('Unknown or duplicate argument.')
    if (['--project', '--uid', '--email'].includes(flag)) {
      const value = args[++index]
      if (!value || value.startsWith('--') || value !== value.trim()) throw new Error(`Missing/invalid ${flag}.`)
      values[flag] = value
    } else values[flag] = true
  }
  if (!values['--project'] || !values['--uid'] || !values['--email'] || Boolean(values['--grant']) === Boolean(values['--revoke'])) {
    throw new Error('Usage: node scripts/admin-claims.mjs --project PROJECT --uid UID --email EMAIL (--grant | --revoke) [--apply]. Without --apply: read-only preview.')
  }
  return { projectId: values['--project'], uid: values['--uid'], email: values['--email'], grant: Boolean(values['--grant']), apply: Boolean(values['--apply']) }
}

export async function updateAdminClaim(auth, request, log = console.log) {
  const { projectId, uid, email, grant, apply } = request
  const user = await auth.getUser(uid)
  if (user.email?.toLowerCase() !== email.toLowerCase()) throw new Error('UID/email mismatch; no changes made.')
  if (grant && (user.disabled || !user.emailVerified || !user.providerData.some((p) => p.providerId === 'google.com'))) {
    throw new Error('Grant requires an enabled, verified Google account; no changes made.')
  }
  const claims = { ...user.customClaims }
  if (grant) claims.admin = true
  else delete claims.admin
  log(`${apply ? 'Apply' : 'Read-only preview'}: ${grant ? 'grant' : 'revoke'} admin for UID ${uid} (${user.email}) in project ${projectId}.`)
  if (apply) {
    await auth.setCustomUserClaims(uid, claims)
    if (!grant) await auth.revokeRefreshTokens(uid)
    log('Done. Sign out/in for a new token. Existing ID tokens may remain valid until expiration (up to one hour).')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const request = parseRequest(process.argv.slice(2))
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Do not mix emulator credentials with administrator provisioning.')
  const app = initializeApp({ credential: applicationDefault(), projectId: request.projectId })
  try { await updateAdminClaim(getAuth(app), request) }
  finally { await deleteApp(app) }
}