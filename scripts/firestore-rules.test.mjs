import { after, before, beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

const projectId = 'demo-red-tide-admin'
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '').split(':')
if (host !== '127.0.0.1' || port !== '8085') throw new Error('Run npm run test:rules with the local emulator; live tests are forbidden.')
let env
const adminToken = { admin: true, email_verified: true, firebase: { sign_in_provider: 'google.com' } }
const database = (claims) => claims === null ? env.unauthenticatedContext().firestore()
  : env.authenticatedContext('synthetic-user', claims).firestore()
const report = () => ({ zoneId: 'pp-bay', description: 'Synthetic community observation.', photoUrl: null, status: 'pending', submittedAt: serverTimestamp() })
before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: {
    host, port: Number(port), rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  } })
})
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'zones/pp-bay'), { name: 'Synthetic bay', polygon: [], status: 'safe' })
    await setDoc(doc(db, 'reports/test-report'), report())
  })
})
after(async () => { await env?.cleanup() })

for (const [label, claims] of [
  ['anonymous', null], ['ordinary Google user', { email_verified: true, firebase: { sign_in_provider: 'google.com' } }],
  ['string claim', { ...adminToken, admin: 'true' }], ['unverified admin', { ...adminToken, email_verified: false }],
  ['password-provider admin', { ...adminToken, firebase: { sign_in_provider: 'password' } }],
]) {
  test(`${label} cannot moderate, seed zones, delete, or grant itself access`, async () => {
    const db = database(claims)
    await assertFails(updateDoc(doc(db, 'zones/pp-bay'), { status: 'advisory', lastUpdated: serverTimestamp() }))
    await assertFails(updateDoc(doc(db, 'reports/test-report'), { status: 'confirmed', reviewedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(db, 'zones/new-zone'), { name: 'Injected', polygon: [], status: 'safe' }))
    await assertFails(deleteDoc(doc(db, 'reports/test-report')))
    await assertFails(setDoc(doc(db, 'admins/synthetic-user'), { admin: true }))
  })
}
test('verified Google admin can approve/reject and change zone status', async () => {
  const db = database(adminToken)
  await assertSucceeds(updateDoc(doc(db, 'reports/test-report'), { status: 'confirmed', reviewedAt: serverTimestamp() }))
  await assertSucceeds(updateDoc(doc(db, 'reports/test-report'), { status: 'rejected', reviewedAt: serverTimestamp() }))
  for (const status of ['advisory', 'unconfirmed', 'safe']) {
    await assertSucceeds(updateDoc(doc(db, 'zones/pp-bay'), { status, lastUpdated: serverTimestamp() }))
  }
})
test('even admin cannot edit geometry, report content, inject fields, fake timestamps or delete', async () => {
  const db = database(adminToken)
  for (const data of [{ polygon: [] }, { status: 'official-clearance', lastUpdated: serverTimestamp() }, { status: 'advisory', lastUpdated: new Date(0) }]) {
    await assertFails(updateDoc(doc(db, 'zones/pp-bay'), data))
  }
  for (const data of [{ description: 'Changed content', reviewedAt: serverTimestamp() }, { status: 'confirmed', reviewedAt: new Date(0) }, { status: 'invalid', reviewedAt: serverTimestamp() }]) {
    await assertFails(updateDoc(doc(db, 'reports/test-report'), data))
  }
  await assertFails(deleteDoc(doc(db, 'zones/pp-bay')))
  await assertFails(deleteDoc(doc(db, 'reports/test-report')))
  await assertFails(setDoc(doc(db, 'admins/synthetic-user'), { admin: true }))
})
test('public reads and valid pending submissions still work without sign-in', async () => {
  const db = database(null)
  await assertSucceeds(getDoc(doc(db, 'zones/pp-bay')))
  await assertSucceeds(getDoc(doc(db, 'reports/test-report')))
  await assertSucceeds(setDoc(doc(db, 'reports/new-report'), report()))
})
test('public submissions cannot self-confirm, inject admin fields, or refer to missing zones', async () => {
  const db = database(null)
  for (const change of [{ status: 'confirmed' }, { admin: true }, { reviewedAt: serverTimestamp() }, { zoneId: 'missing' }, { description: 'short' }, { description: 'x'.repeat(2001) }, { photoUrl: 'javascript:alert(1)' }, { submittedAt: new Date(0) }]) {
    await assertFails(setDoc(doc(db, 'reports/new-report'), { ...report(), ...change }))
  }
})
