// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Map as LeafletMap } from 'leaflet'
import { cameraFor } from './camera'

function mapStub() {
  const handlers = new Set<() => void>()
  const map = { stop: vi.fn(), getPane: vi.fn(() => ({})), once: vi.fn((_event, handler) => handlers.add(handler)), off: vi.fn((_event, handler) => handlers.delete(handler)) }
  return { map: map as unknown as LeafletMap, stop: map.stop, pane: map.getPane, handlers }
}
afterEach(() => vi.unstubAllGlobals())
describe('camera ownership', () => {
  it('only settles the latest target when reduced motion is enabled', () => {
    const { map } = mapStub()
    const a = vi.fn(), b = vi.fn()
    cameraFor(map).run(vi.fn(), a, true)
    cameraFor(map).run(vi.fn(), b, true)
    cameraFor(map).settle()
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
  })
  it('an old unmount cannot stop a newer flight', () => {
    const { map, stop } = mapStub()
    const old = cameraFor(map).run(vi.fn(), vi.fn(), true)
    cameraFor(map).run(vi.fn(), vi.fn(), true)
    const count = stop.mock.calls.length
    old()
    expect(stop).toHaveBeenCalledTimes(count)
  })
  it('cancels a queued intro before focus or manual input takes over', () => {
    let callback: FrameRequestCallback = () => {}
    vi.stubGlobal('requestAnimationFrame', vi.fn(fn => { callback = fn; return 1 }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const { map } = mapStub()
    const intro = vi.fn()
    cameraFor(map).run(intro, vi.fn(), true, true)
    cameraFor(map).run(vi.fn(), vi.fn(), false)
    callback(0)
    expect(intro).not.toHaveBeenCalled()
  })
  it('cleans up after Leaflet has removed its pane without calling stop on a dead map', () => {
    const { map, pane, stop, handlers } = mapStub()
    cameraFor(map).run(vi.fn(), vi.fn(), true)
    pane.mockReturnValue(undefined as never)
    const count = stop.mock.calls.length
    cameraFor(map).cancel()
    expect(handlers.size).toBe(0)
    expect(stop).toHaveBeenCalledTimes(count)
  })
})
