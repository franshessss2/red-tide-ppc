import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRequest, updateAdminClaim } from './admin-claims.mjs'
const args = ['--project', 'synthetic-project', '--uid', 'synthetic-uid', '--email', 'owner@example.invalid', '--grant']
const request = parseRequest(args)
const owner = { email: 'owner@example.invalid', disabled: false, emailVerified: true, providerData: [{ providerId: 'google.com' }], customClaims: { otherRole: 'preserved' } }
function fixture(user = owner) {
  const writes = []
  return { writes, auth: { getUser: async (uid) => { assert.equal(uid, request.uid); return user },
    setCustomUserClaims: async (...value) => { writes.push(['claims', ...value]) },
    revokeRefreshTokens: async (...value) => { writes.push(['revoke', ...value]) } } }
}
test('provisioning defaults to read-only and requires explicit project/UID/email/action', async () => {
  assert.equal(request.apply, false)
  for (const bad of [[], [...args, '--revoke'], [...args, '--uid', 'different'], [...args, '--aply'], ['--project', '--uid']]) {
    assert.throws(() => parseRequest(bad))
  }
  const { auth, writes } = fixture()
  await updateAdminClaim(auth, request, () => {})
  assert.deepEqual(writes, [])
})
test('explicit grant preserves existing claims and is scoped to the verified UID', async () => {
  const { auth, writes } = fixture()
  await updateAdminClaim(auth, { ...request, apply: true }, () => {})
  assert.deepEqual(writes, [['claims', request.uid, { otherRole: 'preserved', admin: true }]])
})
test('mismatched email, disabled, unverified or non-Google users cannot be granted access', async () => {
  for (const change of [{ email: 'someone-else@example.invalid' }, { disabled: true }, { emailVerified: false }, { providerData: [{ providerId: 'password' }] }]) {
    const { auth, writes } = fixture({ ...owner, ...change })
    await assert.rejects(updateAdminClaim(auth, { ...request, apply: true }, () => {}))
    assert.deepEqual(writes, [])
  }
})
test('explicit revocation removes only admin and revokes refresh tokens', async () => {
  const { auth, writes } = fixture({ ...owner, customClaims: { admin: true, otherRole: 'preserved' } })
  await updateAdminClaim(auth, { ...request, grant: false, apply: true }, () => {})
  assert.deepEqual(writes, [['claims', request.uid, { otherRole: 'preserved' }], ['revoke', request.uid]])
})
