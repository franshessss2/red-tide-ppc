import type { AppState } from '../store'

export const ZONE_IDS = ['pp-bay', 'sta-lourdes', 'honda-inner', 'honda-outer', 'binuatan', 'sabang', 'irawan'] as const
export type Symbol = 'S' | 'A' | 'U' | 'X'
export interface DisplayFrame { states: string; any: boolean; usable: boolean; demo: boolean }
export type DisplaySource = Pick<AppState, 'zones' | 'zonesReady' | 'zonesFeed' | 'backendKind'>
export const STALE_FRAME: DisplayFrame = { states: 'XXXXXXX', any: false, usable: false, demo: true }

export function selectDisplay(source: DisplaySource): DisplayFrame {
  const { zones, zonesReady, zonesFeed, backendKind } = source
  const real = backendKind === 'firebase' && zonesFeed.phase === 'synced' && zonesFeed.lastSyncedAt !== null && !zonesFeed.error && zonesReady
  const sample = backendKind === 'demo' && zonesFeed.phase === 'sample' && !zonesFeed.error && zonesReady
  if (!real && !sample) return { ...STALE_FRAME }
  const symbols: Record<string, Symbol> = { safe: 'S', advisory: 'A', unconfirmed: 'U', unknown: 'X' }
  const states = ZONE_IDS.map(id => {
    const matches = zones.filter(zone => zone.id === id)
    return matches.length === 1 ? symbols[matches[0].status] ?? 'X' : 'X'
  }).join('')
  return { states, any: states.includes('A'), usable: true, demo: !real }
}

export function crc8(text: string): number {
  let crc = 0
  for (const char of text) {
    const byte = char.charCodeAt(0)
    if (byte > 127) throw Error('Protocol is ASCII only')
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = ((crc & 0x80) ? (crc << 1) ^ 0x07 : crc << 1) & 0xff
  }
  return crc
}
export function checkedLine(payload: string): string {
  return `${payload}*${crc8(payload).toString(16).toUpperCase().padStart(2, '0')}`
}
export function encodeFrame(frame: DisplayFrame): string {
  if (!/^[SAUX]{7}$/.test(frame.states) || frame.any !== frame.states.includes('A') || (!frame.usable && (frame.any || frame.states !== 'XXXXXXX'))) throw Error('Invalid display frame')
  return checkedLine(`Z1,${frame.states},${+frame.any},${+frame.usable},${+frame.demo}`)
}
export function parseFrame(line: string): DisplayFrame | null {
  const match = /^Z1,([SAUX]{7}),([01]),([01]),([01])\*([0-9A-F]{2})$/.exec(line)
  if (!match || checkedLine(line.slice(0, 16)) !== line) return null
  const frame = { states: match[1], any: match[2] === '1', usable: match[3] === '1', demo: match[4] === '1' }
  if (frame.any !== frame.states.includes('A') || (!frame.usable && frame.states !== 'XXXXXXX')) return null
  return frame
}
