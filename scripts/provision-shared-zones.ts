/** Trusted operator only. Default is a network-free dry run; never overwrites.
 * Apply with GOOGLE_CLOUD_PROJECT=red-tide-ppc and Application Default Credentials.
 * No service-account file or account password belongs in this repository.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { SEED_ZONES } from '../src/data/zones'
import { toFirestorePolygon } from '../src/lib/firestoreMapping'

const apply = process.argv.includes('--apply')
if (process.argv.includes('--force')) throw Error('Overwriting existing zone records is forbidden.')
const zones = SEED_ZONES.map(zone => ({ id: zone.id, data: {
  name: zone.name, description: zone.description,
  polygon: toFirestorePolygon(zone.polygon), lastUpdated: null,
  // Deliberately omit status: the UI maps missing status to unavailable.
} }))
if (!apply) {
  console.log(JSON.stringify({ dryRun: true, dataset: 'community-v1', zones: zones.map(zone => ({ id: zone.id, status: 'unavailable', vertices: zone.data.polygon.length })) }, null, 2))
} else {
  if (process.env.GOOGLE_CLOUD_PROJECT !== 'red-tide-ppc') throw Error('Explicit GOOGLE_CLOUD_PROJECT=red-tide-ppc required.')
  const db = getFirestore(initializeApp({ projectId: 'red-tide-ppc', credential: applicationDefault() }))
  for (const zone of zones) {
    const reference = db.doc(`datasets/community-v1/zones/${zone.id}`)
    try { await reference.create(zone.data); console.log(`Created unavailable zone: ${zone.id}`) }
    catch (error) {
      if ((error as { code?: number }).code !== 6) throw error
      console.log(`Preserved existing zone: ${zone.id}`)
    }
  }
}
