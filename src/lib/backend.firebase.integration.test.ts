/// <reference types="node" />
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, serverTimestamp, setDoc, updateDoc, disableNetwork, enableNetwork, type Firestore } from 'firebase/firestore'
import type { Report, Zone } from '../types'
import { createFirebaseBackend } from './backend.firebase'

// This test talks only to the explicit local emulator, never a real project.
vi.mock('./firebase', () => ({ firestore: () => { throw Error('Explicit emulator database required') } }))
const active = process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8085'
let environment: RulesTestEnvironment
const stops: (() => void)[] = []
beforeAll(async () => {
  if (!active) return
  environment = await initializeTestEnvironment({ projectId: 'demo-red-tide-admin', firestore: {
    host: '127.0.0.1', port: 8085, rules: await readFile('firestore.rules', 'utf8'),
  } })
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'datasets/community-v1/zones/pp-bay'), {
      name: 'Synthetic test bay', description: 'Emulator only', polygon: [{ lat: 9.7, lng: 118.7 }, { lat: 9.8, lng: 118.8 }, { lat: 9.7, lng: 118.8 }],
      status: 'safe', lastUpdated: serverTimestamp(),
    })
  })
})
afterAll(async () => { stops.forEach(stop => stop()); await environment?.cleanup() })

it.skipIf(!active)('phone, web and desktop share pending reports and only admin review changes zones; offline writes await acknowledgement', async () => {
  const clients = ['phone', 'website', 'desktop'].map(() => {
    const db = environment.unauthenticatedContext().firestore() as unknown as Firestore
    const backend = createFirebaseBackend(() => db)
    const state = { reports: [] as Report[], zones: [] as Zone[], acknowledged: false }
    stops.push(backend.subscribeToZones(zones => { state.zones = zones }))
    stops.push(backend.subscribeToReports((reports, metadata) => {
      state.reports = reports
      state.acknowledged = !metadata.fromCache && !metadata.hasPendingWrites
    }))
    return { db, backend, state }
  })
  await vi.waitFor(() => clients.forEach(client => expect(client.state.zones).toHaveLength(1)), { timeout: 10000 })
  const sent = await clients[0].backend.addReport({ zoneId: 'pp-bay', description: 'Synthetic phone submission for shared sync test.', photoUrl: null })
  await vi.waitFor(() => clients.forEach(client => {
    expect(client.state.reports.find(report => report.id === sent.id)?.status).toBe('pending')
    expect(client.state.zones[0].status).toBe('safe')
    expect(client.state.acknowledged).toBe(true)
  }), { timeout: 10000 })

  // Anonymous readers cannot approve their own reports on the server.
  await expect(updateDoc(doc(clients[0].db, 'datasets/community-v1/reports', sent.id), { status: 'confirmed', reviewedAt: serverTimestamp() })).rejects.toMatchObject({ code: 'permission-denied' })
  const admin = environment.authenticatedContext('synthetic-admin', { admin: true, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore()
  await updateDoc(doc(admin, 'datasets/community-v1/reports', sent.id), { status: 'confirmed', reviewedAt: serverTimestamp() })
  await updateDoc(doc(admin, 'datasets/community-v1/zones/pp-bay'), { status: 'advisory', lastUpdated: serverTimestamp() })
  await vi.waitFor(() => clients.forEach(client => {
    expect(client.state.reports.find(report => report.id === sent.id)?.status).toBe('confirmed')
    expect(client.state.zones[0].status).toBe('advisory')
  }), { timeout: 10000 })

  await disableNetwork(clients[0].db)
  let acknowledged = false
  const queued = clients[0].backend.addReport({ zoneId: 'pp-bay', description: 'Synthetic interrupted connection test.', photoUrl: null }).then(report => { acknowledged = true; return report })
  await vi.waitFor(() => expect(clients[0].state.reports).toHaveLength(2), { timeout: 10000 })
  expect(acknowledged).toBe(false)
  expect(clients[0].state.acknowledged).toBe(false)
  expect(clients[1].state.reports).toHaveLength(1)
  await enableNetwork(clients[0].db)
  const resumed = await queued
  await vi.waitFor(() => clients.forEach(client => {
    expect(client.state.reports).toHaveLength(2)
    expect(client.state.acknowledged).toBe(true)
    expect(client.state.reports.find(report => report.id === resumed.id)?.status).toBe('pending')
  }), { timeout: 10000 })
  await updateDoc(doc(admin, 'datasets/community-v1/reports', resumed.id), { status: 'rejected', reviewedAt: serverTimestamp() })
  await vi.waitFor(() => clients.forEach(client => {
    expect(client.state.reports.find(report => report.id === resumed.id)?.status).toBe('rejected')
    expect(client.state.zones[0].status).toBe('advisory')
  }), { timeout: 10000 })
}, 30000)
