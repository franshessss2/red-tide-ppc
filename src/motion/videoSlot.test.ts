import { describe, expect, it, vi } from 'vitest'
import { createVideoSlot } from './videoSlot'

describe('videoSlot — one decoder permit at a time', () => {
  it('grants the first request immediately and queues the rest', () => {
    const slot = createVideoSlot(1)
    const a = Symbol('a')
    const b = Symbol('b')
    const grants: symbol[] = []

    slot.request(a, (token) => grants.push(token))
    slot.request(b, (token) => grants.push(token))

    expect(grants).toEqual([a])
    expect(slot.activeCount).toBe(1)
    expect(slot.waitingCount).toBe(1)
    expect(slot.isActive(a)).toBe(true)
    expect(slot.isActive(b)).toBe(false)
  })

  it('promotes waiters in arrival order, never holding two permits', () => {
    const slot = createVideoSlot(1)
    const [a, b, c] = [Symbol('a'), Symbol('b'), Symbol('c')]
    const grants: symbol[] = []
    const cancelA = slot.request(a, (token) => grants.push(token))
    slot.request(b, (token) => grants.push(token))
    slot.request(c, (token) => grants.push(token))

    cancelA()
    expect(slot.activeCount).toBe(1)
    expect(grants).toEqual([a, b])

    slot.release(b)
    expect(slot.activeCount).toBe(1)
    expect(grants).toEqual([a, b, c])
    expect(slot.waitingCount).toBe(0)
  })

  it('ignores a duplicate request and a release from someone who never held it', () => {
    const slot = createVideoSlot(1)
    const a = Symbol('a')
    const b = Symbol('b')
    const grantA = vi.fn()
    slot.request(a, grantA)
    slot.request(a, grantA)
    expect(grantA).toHaveBeenCalledTimes(1)
    expect(slot.activeCount).toBe(1)

    slot.release(b)
    expect(slot.isActive(a)).toBe(true)
    expect(slot.activeCount).toBe(1)
  })

  it('drops a waiter that gives up before its turn', () => {
    const slot = createVideoSlot(1)
    const a = Symbol('a')
    const b = Symbol('b')
    const c = Symbol('c')
    const grantC = vi.fn()
    const cancelA = slot.request(a, vi.fn())
    const cancelB = slot.request(b, vi.fn())
    slot.request(c, grantC)
    expect(slot.waitingCount).toBe(2)

    cancelB()
    expect(slot.waitingCount).toBe(1)
    cancelA()
    expect(grantC).toHaveBeenCalledTimes(1)
    expect(slot.isActive(c)).toBe(true)
    expect(slot.activeCount).toBe(1)
  })

  it('honours a larger limit without exceeding it', () => {
    const slot = createVideoSlot(2)
    const tokens = [Symbol('a'), Symbol('b'), Symbol('c')]
    const grants: symbol[] = []
    for (const token of tokens) slot.request(token, (granted) => grants.push(granted))
    expect(slot.activeCount).toBe(2)
    expect(grants).toEqual([tokens[0], tokens[1]])
  })
})
