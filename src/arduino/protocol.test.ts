import { describe, expect, it } from 'vitest'
import golden from '../../arduino/libraries/RedTideZones/src/GoldenCrc.h?raw'
import { checkedLine, crc8, encodeFrame, parseFrame, selectDisplay, STALE_FRAME, ZONE_IDS } from './protocol'
import type { DisplaySource } from './protocol'
import type { Zone } from '../types'

const vectors = [...golden.matchAll(/V\("([^"]*)", 0x([0-9A-F]{2})\)/g)].map(match => ({ text: match[1], expected: parseInt(match[2], 16) }))
// Independent polynomial long division of the whole augmented message. Unlike
// production this does not update an 8-bit register one input byte at a time.
function polynomialRemainder(text: string) {
  let value = 0n
  for (const char of text) value = (value << 8n) | BigInt(char.charCodeAt(0))
  value <<= 8n
  for (let bit = text.length * 8 + 7; bit >= 8; bit--) if (value & (1n << BigInt(bit))) value ^= 0x107n << BigInt(bit - 8)
  return Number(value)
}
const source = (phase: DisplaySource['zonesFeed']['phase'] = 'sample'): DisplaySource => ({
  zones: ZONE_IDS.map(id => ({ id, name: id, status: 'safe', lastUpdated: null, polygon: [], description: '' })),
  backendKind: 'demo', zonesReady: true, zonesFeed: { phase, error: null, lastSyncedAt: null },
})
describe('shared JS/sketch CRC contract', () => {
  it('has seven shared literal vectors including independently hand-computed A=C0', () => {
    expect(vectors).toHaveLength(7)
    expect(vectors).toContainEqual({ text: 'A', expected: 0xC0 })
    for (const vector of vectors) {
      expect(polynomialRemainder(vector.text)).toBe(vector.expected)
      expect(crc8(vector.text)).toBe(vector.expected)
    }
  })
  it('covers the demo bit and rejects altered, non-ASCII and inconsistent frames', () => {
    const line = encodeFrame({ states: 'AXUSSSS', any: true, usable: true, demo: false })
    expect(line).toBe('Z1,AXUSSSS,1,1,0*0C')
    expect(parseFrame(line)).toEqual({ states: 'AXUSSSS', any: true, usable: true, demo: false })
    expect(parseFrame(line.replace(',0*', ',1*'))).toBeNull()
    for (const invalid of [line + 'x', line.slice(1), checkedLine('Z1,AXUSSSS,0,1,0'), checkedLine('Z1,SSSSSSS,0,0,1'), checkedLine('Z1,SSSSSS?,0,1,1')]) expect(parseFrame(invalid)).toBeNull()
    expect(() => checkedLine('é')).toThrow(/ASCII/)
    expect(parseFrame(encodeFrame(STALE_FRAME))).toEqual(STALE_FRAME)
  })
})
describe('read-only feed projection', () => {
  it('maps stable IDs independently of store sorting; handles missing/invalid/duplicate records', () => {
    const state = source()
    state.zones[0].status = 'advisory'; state.zones[1].status = 'unconfirmed'; state.zones[2].status = 'unknown'
    state.zones.reverse()
    expect(selectDisplay(state)).toEqual({ states: 'AU XSSSS'.replace(' ', ''), any: true, usable: true, demo: true })
    state.zones = state.zones.filter(zone => zone.id !== 'irawan')
    state.zones.push({ ...state.zones.find(zone => zone.id === 'sabang')! })
    const invalid = state.zones.find(zone => zone.id === 'binuatan')!
    invalid.status = 'broken' as Zone['status']
    expect(selectDisplay(state).states).toBe('AUXSXXX')
  })
  it.each(['loading', 'cached', 'pending', 'error'] as const)('keeps %s stale/demo, even with retained records', phase => {
    const state = source(phase); state.backendKind = 'firebase'; state.zonesFeed.lastSyncedAt = 1
    expect(selectDisplay(state)).toEqual(STALE_FRAME)
  })
  it('only removes demo for a ready, error-free, acknowledged Firebase synced feed', () => {
    const state = source('synced'); state.backendKind = 'firebase'
    expect(selectDisplay(state)).toEqual(STALE_FRAME)
    state.zonesFeed.lastSyncedAt = 1 // Age alone is not a server health signal.
    expect(selectDisplay(state)).toMatchObject({ demo: false, usable: true })
    state.zonesFeed.error = 'unavailable'
    expect(selectDisplay(state)).toEqual(STALE_FRAME)
    state.zonesFeed.error = null; state.zonesReady = false
    expect(selectDisplay(state)).toEqual(STALE_FRAME)
    expect(selectDisplay(source())).toMatchObject({ demo: true, usable: true })
  })
})
