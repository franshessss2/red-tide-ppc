// Test-only USB streams; no shipped file imports this fixture.
import { vi } from 'vitest'
import type { ZonePort } from './serial'
export class FakeZonePort implements ZonePort {
  controller!: ReadableStreamDefaultController<Uint8Array>
  readable = new ReadableStream<Uint8Array>({ start: controller => { this.controller = controller } })
  sent: string[] = []
  writable = new WritableStream<Uint8Array>({ write: bytes => { this.sent.push(new TextDecoder().decode(bytes).trim()) } })
  open = vi.fn(async () => {})
  close = vi.fn(async () => {})
  input(text: string) { this.controller.enqueue(new TextEncoder().encode(text)) }
  line(text: string) { this.input(text + '\n') }
}
