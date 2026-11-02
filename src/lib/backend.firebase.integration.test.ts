/// <reference types="node" />
import { readFile } from 'node:fs/promises'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, serverTimestamp, setDoc, updateDoc, disableNetwork, enableNetwork, type Firestore } from 'firebase/firestore'
import type { Report, Zone, ZoneChange } from '../types'
import { createFirebaseBackend } from './backend.firebase'
import { activityCursor, observeReports, type ReportEvent } from './sharedActivity'
import { emptyFeed, receivedFeed } from './feed'

// This test talks only to the explicit local emulator, never a real project.
vi.mock('./firebase', () => ({ firestore: () => { throw Error('Explicit emulator database required') } }))
vi.mock('./adminAuth', () => ({ requireFirebaseAdmin: async () => {} }))
const active = process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8085'
let environment: RulesTestEnvironment
const stops: (() => void)[] = []
beforeAll(async () => {
  if (!active) return
  environment = await initializeTestEnvironment({ projectId: 'demo-red-tide-admin', firestore: {
    host: '127.0.0.1', port: 8085, rules: await readFile('firestore.rules', 'utf8'),
  } })
})
beforeEach(async () => {
  if (!active) return
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'datasets/community-v1/zones/pp-bay'), {
      name: 'Synthetic test bay', description: 'Emulator only', polygon: [{ lat: 9.7, lng: 118.7 }, { lat: 9.8, lng: 118.8 }, { lat: 9.7, lng: 118.8 }],
      status: 'safe', lastUpdated: serverTimestamp(),
    })
  })
})
afterEach(() => { stops.splice(0).forEach(stop => stop()) })
afterAll(async () => { await environment?.cleanup() })

it.skipIf(!active).each([0, 1, 2])('client %i submits to all three clients; review and offline acknowledgement remain honest', async sender => {
  const clients = ['phone', 'website', 'desktop'].map(() => {
    const db = environment.unauthenticatedContext().firestore() as unknown as Firestore
    const backend = createFirebaseBackend(() => db)
    const state = { reports: [] as Report[], zones: [] as Zone[], history: [] as ZoneChange[], acknowledged: false }
    const cursor = activityCursor(), events: ReportEvent[] = []
    stops.push(backend.subscribeToZones(zones => { state.zones = zones }))
    stops.push(backend.subscribeToZoneChanges!(changes => { state.history = changes }))
    stops.push(backend.subscribeToReports((reports, metadata) => {
      state.reports = reports
      state.acknowledged = !metadata.fromCache && !metadata.hasPendingWrites
      events.push(...observeReports(cursor, reports, receivedFeed(emptyFeed(), 'firebase', metadata)))
    }))
    return { db, backend, state, events }
  })
  await vi.waitFor(() => clients.forEach(client => expect(client.state.zones).toHaveLength(1)), { timeout: 10000 })
  await vi.waitFor(() => clients.forEach(client => expect(client.state.acknowledged).toBe(true)))
  const sent = await clients[sender].backend.addReport({ zoneId: 'pp-bay', description: 'Synthetic shared submission from client '+sender, photoUrl: null })
  await vi.waitFor(() => clients.forEach(client => {
    expect(client.state.reports.find(report => report.id === sent.id)?.status).toBe('pending')
    expect(client.state.zones[0].status).toBe('safe')
    expect(client.state.acknowledged).toBe(true)
    expect(client.events.filter(event => event.key === sent.id+':pending')).toHaveLength(1)
  }), { timeout: 10000 })

  // Anonymous readers cannot approve their own reports on the server.
  await expect(updateDoc(doc(clients[0].db, 'datasets/community-v1/reports', sent.id), { status: 'confirmed', reviewedAt: serverTimestamp() })).rejects.toMatchObject({ code: 'permission-denied' })
  const admin = environment.authenticatedContext('synthetic-admin', { admin: true, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore()
  await updateDoc(doc(admin, 'datasets/community-v1/reports', sent.id), { status: 'confirmed', reviewedAt: serverTimestamp() })
  await createFirebaseBackend(() => admin as unknown as Firestore).setZoneStatus('pp-bay', 'advisory', { note: 'Reviewed synthetic observation.', reportId: sent.id })
  await vi.waitFor(() => clients.forEach(client => {
    expect(client.state.reports.find(report => report.id === sent.id)?.status).toBe('confirmed')
    expect(client.state.zones[0].status).toBe('advisory')
    expect(client.state.history).toHaveLength(1)
    expect(client.state.history[0]).toMatchObject({ fromStatus: 'safe', toStatus: 'advisory', note: 'Reviewed synthetic observation.', reportId: sent.id })
    expect(client.events.filter(event => event.key === sent.id+':confirmed')).toHaveLength(1)
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

it.skipIf(!active)('pages dated archives and undated legacy records while retaining every pending report', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    await Promise.all(Array.from({ length: 65 }, (_, index) => setDoc(doc(db, 'datasets/community-v1/reports', `page-${String(index).padStart(3, '0')}`), {
      zoneId: 'pp-bay', description: 'Synthetic archive record.', photoUrl: null, status: index < 4 ? 'pending' : 'confirmed', submittedAt: new Date(1700000000000 + index * 1000),
    })))
    await setDoc(doc(db, 'datasets/community-v1/reports/legacy-undated'), { zoneId: 'pp-bay', description: 'Synthetic undated record.', photoUrl: null, status: 'rejected' })
    await Promise.all(Array.from({ length: 65 }, (_, index) => setDoc(doc(db, 'datasets/community-v1/zoneChanges', `history-${index}`), {
      zoneId: 'pp-bay', fromStatus: 'advisory', toStatus: 'safe', note: 'Synthetic historical event.', reportId: null, changedAt: new Date(1700000000000 + index * 1000),
    })))
  })
  const db = environment.unauthenticatedContext().firestore() as unknown as Firestore
  const backend = createFirebaseBackend(() => db)
  let reports: Report[] = [], history: ZoneChange[] = [], reportCursor: unknown, historyCursor: unknown
  stops.push(backend.subscribeToReports((next, metadata) => { reports = next; reportCursor = metadata.cursor }))
  stops.push(backend.subscribeToZoneChanges!((next, metadata) => { history = next; historyCursor = metadata?.cursor }))
  await vi.waitFor(() => { expect(reports).toHaveLength(34); expect(history).toHaveLength(30) })
  expect(reports.filter(report => report.status === 'pending')).toHaveLength(4)
  const older = await backend.reportPage!(reportCursor)
  const last = await backend.reportPage!(older.cursor)
  const datedIds = new Set([...reports.filter(report => report.id.startsWith('page-')).slice(), ...older.records, ...last.records].map(report => report.id))
  expect(datedIds.size).toBe(65)
  expect(older.hasMore).toBe(true); expect(last.hasMore).toBe(false)
  let cursor: unknown, more = true
  const all = new Set<string>()
  while (more) { const page = await backend.reportPage!(cursor, true); page.records.forEach(report => all.add(report.id)); cursor = page.cursor; more = page.hasMore }
  expect(all.size).toBe(66); expect(all.has('legacy-undated')).toBe(true)
  const olderHistory = await backend.zoneChangePage!(historyCursor)
  const lastHistory = await backend.zoneChangePage!(olderHistory.cursor)
  expect(new Set([...history, ...olderHistory.records, ...lastHistory.records].map(event => event.id)).size).toBe(65)
}, 30000)

it.skipIf(!active)('retries a stable report ID after review without creating or rewriting another report', async () => {
  const backend = createFirebaseBackend(() => environment.unauthenticatedContext().firestore() as unknown as Firestore)
  const id = `rtp-${crypto.randomUUID()}`
  const input = { zoneId: 'pp-bay', description: 'Synthetic stable-ID report.', photoUrl: null }
  await backend.addReport(input, id)
  const admin = environment.authenticatedContext('synthetic-admin', { admin: true, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore()
  await updateDoc(doc(admin, 'datasets/community-v1/reports', id), { status: 'confirmed', reviewedAt: serverTimestamp() })
  expect(await backend.addReport(input, id)).toMatchObject({ id, status: 'confirmed' })
  await expect(backend.addReport({ ...input, description: 'A different observation must not overwrite the original.' }, id)).rejects.toThrow('different report')
  expect(await backend.getReport!(id)).toMatchObject({ description: input.description, status: 'confirmed' })
}, 30000)
