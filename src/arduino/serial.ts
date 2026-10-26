import { checkedLine, encodeFrame, STALE_FRAME } from './protocol'
import type { DisplayFrame } from './protocol'

// Structural Web Serial types: no global augmentation and no runtime dependency.
export interface ZonePort {
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
}
export interface SerialAccess { requestPort(): Promise<ZonePort> }
export interface LinkState { phase: 'disconnected' | 'identifying' | 'waiting' | 'acknowledged' | 'error'; message: string; acknowledged: DisplayFrame | null }

// This module has no app/store/backend imports. Input can only affect link state.
export class ZoneSerial {
  private port: ZonePort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private reading: Promise<void> | null = null
  private writes: Promise<void> = Promise.resolve()
  private timer: ReturnType<typeof setInterval> | undefined
  private ready = false
  private connecting = false
  private generation = 0
  private started = 0
  private lastHello = 0
  private lastSent = 0
  private pending: { line: string; at: number } | null = null
  private desired = encodeFrame(STALE_FRAME)
  private lastBeep = -Infinity
  constructor(private changed: (state: LinkState) => void, private now = Date.now) {}
  private state(phase: LinkState['phase'], message: string, acknowledged: DisplayFrame | null = null) {
    this.changed({ phase, message, acknowledged })
  }
  setFrame(frame: DisplayFrame) {
    this.desired = encodeFrame(frame)
    if (this.ready && !this.pending && this.desired !== this.lastAcknowledged) this.transmit()
  }
  private lastAcknowledged = ''
  async connect(access: SerialAccess) {
    if (this.port || this.connecting) return
    this.connecting = true
    const generation = ++this.generation
    let selected: ZonePort | null = null
    try {
      selected = await access.requestPort()
      if (generation !== this.generation) return
      await selected.open({ baudRate: 9600 })
      if (generation !== this.generation) { await selected.close(); return }
      this.port = selected
      if (!selected.readable || !selected.writable) throw Error('Serial streams unavailable')
      this.reader = selected.readable.getReader()
      this.started = this.now(); this.lastHello = this.started
      this.ready = false; this.pending = null; this.lastAcknowledged = ''
      this.state('identifying', 'Waiting for RT1 ZONES READY…')
      this.reading = this.read(this.reader, generation)
      this.timer = setInterval(() => this.tick(), 250)
      this.write('HELLO')
    } catch (error) {
      if (generation === this.generation) {
        if (!this.port && selected) await selected.close().catch(() => {})
        await this.disconnect(error instanceof Error ? error.message : 'USB unavailable', true)
      }
    } finally { if (generation === this.generation) this.connecting = false }
  }
  private write(line: string) {
    const port = this.port, generation = this.generation
    this.writes = this.writes.then(async () => {
      if (generation !== this.generation || !port?.writable) return
      const writer = port.writable.getWriter()
      try { await writer.write(new TextEncoder().encode(`${line}\n`)) } finally { writer.releaseLock() }
    }).catch(() => { if (generation === this.generation) void this.disconnect('USB write failed', true) })
  }
  private transmit() {
    if (!this.ready || this.pending) return
    this.lastSent = this.now()
    this.pending = { line: this.desired, at: this.lastSent }
    this.state('waiting', 'Waiting for board acknowledgment…')
    this.write(this.desired)
  }
  private tick() {
    const now = this.now()
    if (!this.ready) {
      if (now - this.started >= 8000) { void this.disconnect('Wrong or missing firmware: upload red_tide_zones', true); return }
      if (now - this.lastHello >= 1000) { this.lastHello = now; this.write('HELLO') }
    } else if (this.pending && now - this.pending.at >= 4000) void this.disconnect('Board acknowledgment timed out; display will become stale', true)
    else if (!this.pending && now - this.lastSent >= 2000) this.transmit()
  }
  private async read(reader: ReadableStreamDefaultReader<Uint8Array>, generation: number) {
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (generation === this.generation) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let end: number
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end).replace(/\r$/, '')
          buffer = buffer.slice(end + 1)
          if (generation !== this.generation) return
          if (line.length > 80 || /[^\x20-\x7E]/.test(line)) throw Error('Invalid serial message')
          this.receive(line)
        }
        if (buffer.length > 80) throw Error('Serial message too long')
      }
      if (generation === this.generation) queueMicrotask(() => { void this.disconnect('USB connection ended', true) })
    } catch {
      if (generation === this.generation) queueMicrotask(() => { void this.disconnect('USB read failed', true) })
    } finally { reader.releaseLock() }
  }
  private receive(line: string) {
    if (!this.ready && line === 'RT1 ZONES READY') { this.ready = true; this.transmit(); return }
    if (this.ready && this.pending && line === `RT1 ACK ${this.pending.line}`) {
      const accepted = this.pending.line
      this.pending = null; this.lastAcknowledged = accepted
      // Exact echo of our validated output, never deserialize device data into app state.
      const fields = accepted.slice(0, 16).split(',')
      const frame = { states: fields[1], any: fields[2] === '1', usable: fields[3] === '1', demo: fields[4] === '1' }
      this.state('acknowledged', frame.usable ? 'USB acknowledged' : 'USB acknowledged · source unavailable; board stale', frame)
      if (accepted !== this.desired) this.transmit()
    }
  }
  beep() {
    if (!this.ready || this.pending || this.lastAcknowledged !== this.desired || this.desired[13] !== '1' || this.now() - this.lastBeep < 3000) return
    this.lastBeep = this.now(); this.write(checkedLine('BEEP'))
  }
  async disconnect(message = 'Disconnected; board becomes stale within 15 seconds', error = false) {
    ++this.generation; this.connecting = false; this.ready = false; this.pending = null; this.lastAcknowledged = ''
    clearInterval(this.timer)
    const reader = this.reader, port = this.port, reading = this.reading
    this.reader = null; this.port = null; this.reading = null
    this.state(error ? 'error' : 'disconnected', message)
    // Best effort while writable; a broken/busy port still has the board watchdog.
    if (port?.writable && !port.writable.locked) {
      const writer = port.writable.getWriter()
      try { await writer.write(new TextEncoder().encode(encodeFrame(STALE_FRAME) + '\n')) } catch { /* watchdog remains independent */ }
      finally { writer.releaseLock() }
    }
    await reader?.cancel().catch(() => {})
    await reading?.catch(() => {})
    await port?.close().catch(() => {})
  }
  pause() {
    if (!this.port && !this.connecting) return
    // Best effort only: browser termination may prevent this write entirely.
    if (this.ready) this.write(encodeFrame(STALE_FRAME))
    this.state('disconnected', 'Paused: keep this tab visible. Reconnect to resume.')
    this.ready = false
    clearInterval(this.timer)
    // Start cleanup outside the write callback; do not make it await itself.
    void this.writes.then(() => this.disconnect('Paused: keep this tab visible. Reconnect to resume.'))
  }
}
