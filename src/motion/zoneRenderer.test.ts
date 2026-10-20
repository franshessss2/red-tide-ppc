// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { latLng, map as createMap, polygon, type Map as LeafletMap, type LatLng, type LatLngExpression } from 'leaflet'
import { SEED_ZONES } from '../data/zones'
import { createZoneRenderer } from './zoneRenderer'

const maps: LeafletMap[] = []
afterEach(() => {
  for (const map of maps.splice(0)) map.remove()
  document.body.replaceChildren()
})

function scene(center: LatLngExpression, zoom: number) {
  const container = document.createElement('div')
  Object.defineProperties(container, { clientWidth: { value: 800 }, clientHeight: { value: 600 } })
  document.body.append(container)
  const map = createMap(container, { zoomAnimation: false, zoomSnap: 0 }).setView(center, zoom)
  // jsdom lacks 3D support, so setView rounds zoom even with zoomSnap: 0.
  // Set the exact fractional camera before mounting any reference geometry.
  moveFrame(map, latLng(center), zoom)
  maps.push(map)
  map.createPane('zoneCasingPane')
  const renderers = [createZoneRenderer(), createZoneRenderer({ pane: 'zoneCasingPane' })]
  const zone = SEED_ZONES.find(zone => zone.id === 'sabang')!
  const paths = renderers.map(renderer => polygon(zone.polygon, { renderer }).addTo(map))
  return { map, renderers, paths, geometry: () => paths.map(path => path.getElement()!.getAttribute('d')) }
}

function moveFrame(map: LeafletMap, center: LatLng, zoom: number) {
  const flightMap = map as LeafletMap & {
    _move(center: LatLng, zoom: number, data: { flyTo: boolean }): void
  }
  flightMap._move(center, zoom, { flyTo: true })
}

describe('zone geometry during camera flights', () => {
  it('refreshes status and casing before moveend, including offscreen arrivals and fractional zoom', () => {
    const sceneUnderTest = scene([9.75, 118.73], 13)
    expect(sceneUnderTest.geometry()).toEqual(['M0 0', 'M0 0'])
    const moveend = vi.fn(), viewreset = vi.fn()
    sceneUnderTest.map.on('moveend', moveend).on('viewreset', viewreset)

    // Leaflet flyTo calls this exact primitive for each frame. Unlike setView,
    // it emits only zoom/move, so the old moveend-only renderer fails here.
    for (const [latitude, longitude, zoom] of [
      [10.20, 118.91, 11.25],
      [10.195, 118.916, 12.5],
      [10.19, 118.92, 13],
      [10.195, 118.925, 13],
    ]) {
      moveFrame(sceneUnderTest.map, latLng(latitude, longitude), zoom)
      // A newly mounted renderer at the same camera is the independent
      // reference for projection and clipping bounds, not just path existence.
      const reference = scene([latitude, longitude], zoom)
      expect(sceneUnderTest.geometry()).toEqual(reference.geometry())
      for (const d of sceneUnderTest.geometry()) expect(d!.length).toBeGreaterThan(20)
    }
    expect(moveend).not.toHaveBeenCalled()
    expect(viewreset).not.toHaveBeenCalled()
  })

  it('detaches movement handlers when its renderers are removed', () => {
    const { map, renderers } = scene([10.19, 118.92], 13)
    const update = vi.fn()
    for (const renderer of renderers) renderer.on('update', update)
    map.fire('move')
    expect(update).toHaveBeenCalledTimes(2)
    for (const renderer of renderers) map.removeLayer(renderer)
    update.mockClear()
    expect(() => map.fire('move')).not.toThrow()
    expect(update).not.toHaveBeenCalled()
  })
})
