export const DEVICE_ID = 'wokwi-coast-01'
export const DEVICE_ZONE = 'honda-inner'
export const OFFLINE_AFTER_MS = 180_000
export const HISTORY_LIMIT = 60

export interface DeviceSample {
  deviceId: typeof DEVICE_ID
  sessionId: string
  sequence: number
  temperatureC: number
  cloudinessPercent: number
}

export interface DeviceReading extends DeviceSample {
  receivedAt: number
  source: 'wokwi' | 'local-rehearsal'
  zoneId: typeof DEVICE_ZONE
}

export interface DeviceFeed {
  configured: boolean
  readings: DeviceReading[]
}

export function parseSample(value: unknown): DeviceSample | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const sample = value as Record<string, unknown>
  const keys = ['deviceId', 'sessionId', 'sequence', 'temperatureC', 'cloudinessPercent']
  if (Object.keys(sample).some(key => !keys.includes(key))) return null
  if (sample.deviceId !== DEVICE_ID || typeof sample.sessionId !== 'string' ||
    !/^[a-zA-Z0-9-]{8,40}$/.test(sample.sessionId) ||
    !Number.isSafeInteger(sample.sequence) || (sample.sequence as number) < 0 ||
    typeof sample.temperatureC !== 'number' || !Number.isFinite(sample.temperatureC) ||
    sample.temperatureC < -55 || sample.temperatureC > 125 ||
    typeof sample.cloudinessPercent !== 'number' || !Number.isFinite(sample.cloudinessPercent) ||
    sample.cloudinessPercent < 0 || sample.cloudinessPercent > 100) return null
  return {
    deviceId: DEVICE_ID, sessionId: sample.sessionId, sequence: sample.sequence as number,
    temperatureC: sample.temperatureC, cloudinessPercent: sample.cloudinessPercent,
  }
}

export function parseReading(value: unknown): DeviceReading | null {
  const record = value as Partial<DeviceReading> | null
  if (!record || typeof record !== 'object') return null
  const sample = parseSample({ deviceId: record.deviceId, sessionId: record.sessionId,
    sequence: record.sequence, temperatureC: record.temperatureC, cloudinessPercent: record.cloudinessPercent })
  if (!sample || !Number.isSafeInteger(record.receivedAt) || (record.receivedAt as number) <= 0 ||
    record.zoneId !== DEVICE_ZONE || !['wokwi', 'local-rehearsal'].includes(record.source ?? '')) return null
  return { ...sample, receivedAt: record.receivedAt as number, zoneId: DEVICE_ZONE, source: record.source! }
}

export function connectionLabel(reading: DeviceReading | undefined, now: number): string {
  if (!reading) return 'Waiting for readings'
  return now - reading.receivedAt >= OFFLINE_AFTER_MS ? 'Offline · last reading retained' : 'Receiving readings'
}
