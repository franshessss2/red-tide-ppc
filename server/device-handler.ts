import { createHash, timingSafeEqual } from 'node:crypto'
import { DEVICE_ID, DEVICE_ZONE, HISTORY_LIMIT, parseReading, parseSample } from '../src/devices/model'

export type DeviceEnvironment = Record<string, string | undefined>
export type RedisCommand = (command: (string | number)[]) => Promise<unknown>

// One transaction owns deduplication, ordering, rate limiting and bounded storage.
export const WRITE_READING = `
local prior = redis.call('GET', KEYS[1])
local next = cjson.decode(ARGV[1])
local recent = redis.call('LRANGE', KEYS[2], 0, 59)
local older = false
for _, text in ipairs(recent) do
  local seen = cjson.decode(text)
  if seen.sessionId == next.sessionId then
    if seen.sequence == next.sequence then return 'duplicate' end
    if seen.sequence > next.sequence then older = true end
  end
end
if older then return 'out-of-order' end
if prior then
  local old = cjson.decode(prior)
  if old.sessionId == next.sessionId then
    if old.sequence == next.sequence then return 'duplicate' end
    if old.sequence > next.sequence then return 'out-of-order' end
  end
  if next.receivedAt - old.receivedAt < 30000 then return 'rate-limited' end
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', 86400)
redis.call('LPUSH', KEYS[2], ARGV[1])
redis.call('LTRIM', KEYS[2], 0, 59)
redis.call('EXPIRE', KEYS[2], 86400)
return 'accepted'
`

export function redisClient(env: DeviceEnvironment): RedisCommand {
  return async command => {
    const response = await fetch(env.UPSTASH_REDIS_REST_URL!, {
      method: 'POST', headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command), signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('Device storage unavailable')
    const data = await response.json() as { result?: unknown; error?: string }
    if (data.error || !('result' in data)) throw new Error('Device storage unavailable')
    return data.result
  }
}

function configured(env: DeviceEnvironment) {
  return Boolean(env.DEVICE_INGEST_TOKEN && env.DEVICE_INGEST_TOKEN.length >= 32 && env.DEVICE_INGEST_TOKEN.length <= 128 &&
    /^https:\/\/[^/]+\.upstash\.io\/?$/.test(env.UPSTASH_REDIS_REST_URL ?? '') &&
    env.UPSTASH_REDIS_REST_TOKEN && /^[a-zA-Z0-9-]{1,48}$/.test(env.DEVICE_STORAGE_NAMESPACE ?? ''))
}

function authorized(request: Request, token: string) {
  const received = request.headers.get('authorization') ?? ''
  const hash = (text: string) => createHash('sha256').update(text).digest()
  return received.length <= 256 && timingSafeEqual(hash(received), hash(`Bearer ${token}`))
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } })
}

export async function handleDeviceRequest(request: Request, env: DeviceEnvironment,
  command: RedisCommand = redisClient(env), now = Date.now()): Promise<Response> {
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' })
  if (!configured(env)) return request.method === 'GET'
    ? json({ configured: false, readings: [] }) : json({ error: 'Device connection is not configured' }, 503)
  const prefix = `red-tide:${env.DEVICE_STORAGE_NAMESPACE}:${DEVICE_ID}`
  try {
    if (request.method === 'GET') {
      // Public, synthetic demo readings only. No tokens or real coordinates.
      const records = await command(['LRANGE', `${prefix}:history`, 0, HISTORY_LIMIT - 1])
      if (!Array.isArray(records)) throw new Error('Invalid device storage')
      const readings = records.map(text => parseReading(JSON.parse(String(text))))
      if (readings.some(record => !record || record.source !== 'wokwi')) throw new Error('Invalid device storage')
      return json({ configured: true, readings })
    }
    if (!authorized(request, env.DEVICE_INGEST_TOKEN!)) return json({ error: 'Unauthorized device' }, 401)
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
      return json({ error: 'Use application/json' }, 415)
    }
    if (Number(request.headers.get('content-length')) > 2048) return json({ error: 'Payload too large' }, 413)
    // Bound chunked bodies too; never trust Content-Length alone.
    const reader = request.body?.getReader()
    if (!reader) return json({ error: 'Missing reading' }, 400)
    const chunks: Uint8Array[] = []
    let length = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > 2048) { await reader.cancel(); return json({ error: 'Payload too large' }, 413) }
      chunks.push(value)
    }
    let payload: unknown
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
    catch { return json({ error: 'Invalid JSON' }, 400) }
    const sample = parseSample(payload)
    if (!sample) return json({ error: 'Invalid device reading' }, 400)
    const reading = { ...sample, zoneId: DEVICE_ZONE, source: 'wokwi', receivedAt: now }
    const outcome = await command(['EVAL', WRITE_READING, 2, `${prefix}:latest`, `${prefix}:history`, JSON.stringify(reading)])
    if (outcome === 'rate-limited') return json({ error: 'Wait before sending another reading' }, 429, { 'Retry-After': '30' })
    if (outcome === 'out-of-order') return json({ error: 'Older sequence rejected' }, 409)
    if (!['accepted', 'duplicate'].includes(String(outcome))) throw new Error('Invalid storage result')
    return json({ accepted: true, duplicate: outcome === 'duplicate' }, outcome === 'duplicate' ? 200 : 201)
  } catch {
    // Never leak upstream responses, credentials or configuration in errors.
    return json({ error: 'Device connection unavailable. Try again later.' }, 503)
  }
}
