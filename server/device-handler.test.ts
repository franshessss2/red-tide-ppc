import { describe, expect, it, vi } from 'vitest'
import { handleDeviceRequest, redisClient } from './device-handler'
import { DEVICE_ID, DEVICE_ZONE, connectionLabel, parseSample } from '../src/devices/model'

const env = { DEVICE_INGEST_TOKEN: 'a'.repeat(48), UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'server-only-test-token', DEVICE_STORAGE_NAMESPACE: 'test-device' }
const sample = { deviceId: DEVICE_ID, sessionId: 'boot-123456', sequence: 1, temperatureC: 28, cloudinessPercent: 25 }
const reading = { ...sample, zoneId: DEVICE_ZONE, source: 'wokwi', receivedAt: 1700000000000 }
function post(body: unknown = sample, token = env.DEVICE_INGEST_TOKEN) {
  return new Request('https://red-tide.example/api/device-readings', { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

describe('device ingestion boundary', () => {
  it('fails closed before configuration; read view distinguishes setup from outage', async () => {
    const command = vi.fn()
    const get = await handleDeviceRequest(new Request('https://test/api/device-readings'), {}, command)
    expect(await get.json()).toEqual({ configured: false, readings: [] })
    expect((await handleDeviceRequest(post(), {}, command)).status).toBe(503)
    expect(command).not.toHaveBeenCalled()
  })
  it('rejects unauthenticated writes without touching storage', async () => {
    const command = vi.fn()
    expect((await handleDeviceRequest(post(sample, 'wrong'), env, command)).status).toBe(401)
    expect(command).not.toHaveBeenCalled()
  })
  it.each([
    { ...sample, temperatureC: 126 }, { ...sample, cloudinessPercent: -1 },
    { ...sample, deviceId: 'arbitrary' }, { ...sample, sequence: -1 },
    { ...sample, sequence: 1.5 }, { ...sample, sessionId: 'bad' },
    { ...sample, zoneId: 'fake' }, { ...sample, source: 'real' },
    { ...sample, receivedAt: 1 }, { ...sample, temperatureC: null },
  ])('rejects malformed or privileged payloads: %j', async invalid => {
    const command = vi.fn()
    expect((await handleDeviceRequest(post(invalid), env, command)).status).toBe(400)
    expect(command).not.toHaveBeenCalled()
  })
  it('rejects nonfinite numbers at the shared boundary', () => {
    expect(parseSample({ ...sample, temperatureC: NaN })).toBeNull()
    expect(parseSample({ ...sample, cloudinessPercent: Infinity })).toBeNull()
  })
  it('enforces body bounds even without a content-length', async () => {
    const request = new Request('https://test/api/device-readings', { method: 'POST',
      headers: { Authorization: `Bearer ${env.DEVICE_INGEST_TOKEN}`, 'Content-Type': 'application/json' }, body: ' '.repeat(2049) })
    const command = vi.fn()
    expect((await handleDeviceRequest(request, env, command)).status).toBe(413)
    expect(command).not.toHaveBeenCalled()
  })
  it('assigns provenance, zone and receipt time on the server', async () => {
    const command = vi.fn().mockResolvedValue('accepted')
    const result = await handleDeviceRequest(post(), env, command, reading.receivedAt)
    expect(result.status).toBe(201)
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect(JSON.parse(command.mock.calls[0][0].at(-1))).toEqual(reading)
    expect(command.mock.calls[0][0][0]).toBe('EVAL')
  })
  it.each([['duplicate', 200], ['out-of-order', 409], ['rate-limited', 429]])('handles %s storage result', async (outcome, status) => {
    const result = await handleDeviceRequest(post(), env, vi.fn().mockResolvedValue(outcome))
    expect(result.status).toBe(status)
    if (status === 429) expect(result.headers.get('retry-after')).toBe('30')
  })
  it('reads bounded history without leaking credentials', async () => {
    const command = vi.fn().mockResolvedValue([JSON.stringify(reading)])
    const result = await handleDeviceRequest(new Request('https://test/api/device-readings'), env, command)
    expect(await result.json()).toEqual({ configured: true, readings: [reading] })
    expect(command.mock.calls[0][0]).toEqual(['LRANGE', 'red-tide:test-device:wokwi-coast-01:history', 0, 59])
  })
  it('reports storage failure rather than returning an empty healthy feed', async () => {
    const result = await handleDeviceRequest(new Request('https://test/api/device-readings'), env,
      vi.fn().mockRejectedValue(new Error(env.UPSTASH_REDIS_REST_TOKEN)))
    expect(result.status).toBe(503)
    expect(await result.text()).not.toContain(env.UPSTASH_REDIS_REST_TOKEN)
  })
  it('rejects malformed persisted readings', async () => {
    const result = await handleDeviceRequest(new Request('https://test/api/device-readings'), env, vi.fn().mockResolvedValue(['{}']))
    expect(result.status).toBe(503)
  })
  it('allows only the documented methods and media type', async () => {
    expect((await handleDeviceRequest(new Request('https://test/api/device-readings', { method: 'DELETE' }), env)).status).toBe(405)
    const request = post(); request.headers.set('content-type', 'text/plain')
    expect((await handleDeviceRequest(request, env)).status).toBe(415)
  })
  it('uses the REST command protocol and detects upstream errors', async () => {
    const mock = vi.fn().mockResolvedValue(Response.json({ result: ['one'] }))
    vi.stubGlobal('fetch', mock)
    try {
      expect(await redisClient(env)(['LRANGE', 'key', 0, 59])).toEqual(['one'])
      expect(mock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`)
      mock.mockResolvedValueOnce(Response.json({ error: 'quota exhausted' }))
      await expect(redisClient(env)(['GET', 'key'])).rejects.toThrow('Device storage unavailable')
    } finally { vi.unstubAllGlobals() }
  })
  it('ages a retained reading into offline status', () => {
    expect(connectionLabel(undefined, reading.receivedAt)).toBe('Waiting for readings')
    expect(connectionLabel(reading as Parameters<typeof connectionLabel>[0], reading.receivedAt + 179999)).toBe('Receiving readings')
    expect(connectionLabel(reading as Parameters<typeof connectionLabel>[0], reading.receivedAt + 180000)).toContain('Offline')
  })
})
