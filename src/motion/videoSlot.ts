/**
 * A shared decoder permit.
 *
 * A row of video cards must not decode in parallel: three simultaneous H.264
 * decoders on a mid-range phone is the difference between a smooth page and a
 * dropped scroll. This is the whole policy — `limit` holders at a time, first
 * come first served, everyone else queued in arrival order.
 *
 * The slot knows nothing about React, video elements or the DOM, so the
 * guarantee ("at most one team video decoding at once") is testable on its own.
 */
export type VideoSlotToken = symbol

interface QueueEntry {
  token: VideoSlotToken
  grant: (token: VideoSlotToken) => void
}

export interface VideoSlot {
  /** How many holders currently own a permit. */
  readonly activeCount: number
  /** How many requests are waiting for a permit. */
  readonly waitingCount: number
  isActive(token: VideoSlotToken): boolean
  /**
   * Ask for a permit. `grant` fires synchronously when the permit is free, or
   * later, from whoever releases ahead of this token. Returns a cancel that
   * also acts as a release: safe to call from an effect cleanup.
   */
  request(token: VideoSlotToken, grant: (token: VideoSlotToken) => void): () => void
  /** Give a permit back and promote the next waiter, if any. */
  release(token: VideoSlotToken): void
}

export function createVideoSlot(limit = 1): VideoSlot {
  const active = new Set<VideoSlotToken>()
  const waiting: QueueEntry[] = []

  const dequeue = (token: VideoSlotToken) => {
    const index = waiting.findIndex((entry) => entry.token === token)
    if (index >= 0) waiting.splice(index, 1)
  }

  const promote = () => {
    while (active.size < limit && waiting.length > 0) {
      const next = waiting.shift()!
      if (active.has(next.token)) continue
      active.add(next.token)
      next.grant(next.token)
    }
  }

  const giveUp = (token: VideoSlotToken) => {
    const wasActive = active.delete(token)
    dequeue(token)
    // Only a real release frees capacity; cancelling a waiter changes nothing.
    if (wasActive) promote()
  }

  return {
    get activeCount() { return active.size },
    get waitingCount() { return waiting.length },
    isActive: (token) => active.has(token),
    request(token, grant) {
      if (active.has(token)) return () => {}
      if (active.size < limit) {
        active.add(token)
        grant(token)
      } else if (!waiting.some((entry) => entry.token === token)) {
        waiting.push({ token, grant })
      }
      return () => giveUp(token)
    },
    release: giveUp,
  }
}
