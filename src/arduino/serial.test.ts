import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZoneSerial } from './serial'
import type { LinkState } from './serial'
import { FakeZonePort } from './serial.fixture'
import { checkedLine, encodeFrame, STALE_FRAME } from './protocol'

const sample = { states: 'ASSSSSS', any: true, usable: true, demo: true }
describe('zone serial lifecycle', () => {
  let port: FakeZonePort, client: ZoneSerial
  let changed = vi.fn<(state: LinkState) => void>()
  const flush = () => vi.advanceTimersByTimeAsync(0)
  const identify = async () => { port.line('RT1 ZONES READY'); await flush() }
  const ack = async () => { port.line(`RT1 ACK ${port.sent.at(-1)}`); await flush() }
  beforeEach(async () => {
    vi.useFakeTimers(); vi.setSystemTime(0)
    port = new FakeZonePort(); changed = vi.fn<(state: LinkState) => void>(); client = new ZoneSerial(changed)
    client.setFrame(sample)
    await client.connect({ requestPort: async () => port }); await flush()
  })
  afterEach(async () => { await client.disconnect(); vi.useRealTimers() })
  it('requires its own handshake, exact ACK, coalesces changes and resends every two seconds', async () => {
    expect(port.sent).toEqual(['HELLO'])
    port.line('RT1 COMBINED READY'); await flush(); expect(port.sent).toEqual(['HELLO'])
    await identify(); expect(port.sent.at(-1)).toBe(encodeFrame(sample))
    client.setFrame({ ...sample, demo: false }); client.setFrame({ ...sample, states: 'SSSSSSA', demo: false })
    expect(port.sent).toHaveLength(2)
    port.line('RT1 ACK bogus'); await flush(); expect(changed.mock.lastCall?.[0].phase).toBe('waiting')
    await ack(); expect(port.sent.at(-1)).toBe(encodeFrame({ ...sample, states: 'SSSSSSA', demo: false }))
    await ack(); expect(changed.mock.lastCall?.[0].phase).toBe('acknowledged')
    await vi.advanceTimersByTimeAsync(1999); expect(port.sent).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(1); expect(port.sent).toHaveLength(4)
  })
  it('times out wrong firmware at eight seconds and missing ACK at four seconds', async () => {
    await vi.advanceTimersByTimeAsync(8000)
    expect(changed.mock.lastCall?.[0]).toMatchObject({ phase: 'error' })
    expect(port.close).toHaveBeenCalledOnce()
  })
  it('closes the link on lost acknowledgment', async () => {
    await identify(); await vi.advanceTimersByTimeAsync(4000)
    expect(changed.mock.lastCall?.[0].message).toMatch(/acknowledgment timed out/)
    expect(port.close).toHaveBeenCalledOnce()
  })
  it('sends explicit stale before hidden-tab cleanup; never automatically reconnects', async () => {
    await identify(); await ack(); client.pause(); await flush()
    expect(port.sent.at(-1)).toBe(encodeFrame(STALE_FRAME))
    expect(port.close).toHaveBeenCalledOnce()
    const count = port.sent.length
    await vi.advanceTimersByTimeAsync(20000); expect(port.sent).toHaveLength(count)
  })
  it('limits manual beep requests and requires acknowledged usable data', async () => {
    client.beep(); await flush(); expect(port.sent).not.toContain(checkedLine('BEEP'))
    await identify(); await ack(); client.beep(); client.beep(); await flush()
    expect(port.sent.filter(line => line === checkedLine('BEEP'))).toHaveLength(1)
    client.setFrame(STALE_FRAME); await flush(); await ack(); client.beep(); await flush()
    expect(port.sent.filter(line => line === checkedLine('BEEP'))).toHaveLength(1)
  })
  it('rejects oversized input and handles unexpected read termination', async () => {
    port.input('x'.repeat(81)); await flush()
    expect(changed.mock.lastCall?.[0].phase).toBe('error')
    expect(port.close).toHaveBeenCalledOnce()
  })
})
