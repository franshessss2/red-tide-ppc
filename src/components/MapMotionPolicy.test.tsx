// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MapMotionPolicy } from './MapMotionPolicy'
const state = vi.hoisted(() => ({ reduce: false, map: null as any }))
vi.mock('react-leaflet', () => ({ useMap: () => state.map }))
vi.mock('../motion/preferences', () => ({ useReducedMotion: () => state.reduce }))
afterEach(() => { document.body.innerHTML = ''; state.reduce = false })
it('settles an active camera and disables native inertia when the OS preference changes', () => {
  const container = document.createElement('div'); document.body.append(container)
  const map = { options: {}, getContainer: () => container, getPane: () => ({}), stop: vi.fn(), on: vi.fn(), off: vi.fn(), panBy: vi.fn() }
  state.map = map
  const view = render(<MapMotionPolicy />)
  expect(map.options).toMatchObject({ zoomAnimation: false, inertia: true })
  state.reduce = true; view.rerender(<MapMotionPolicy />)
  expect(map.options).toMatchObject({ zoomAnimation: false, inertia: false, markerZoomAnimation: false })
  expect(map.stop).toHaveBeenCalled()
  fireEvent.keyDown(container, { key: 'ArrowRight' })
  expect(map.panBy).toHaveBeenCalledWith([80, 0], { animate: false })
  view.unmount(); map.panBy.mockClear()
  fireEvent.keyDown(container, { key: 'ArrowRight' })
  expect(map.panBy).not.toHaveBeenCalled()
  expect(map.off).toHaveBeenCalledWith('popupopen', expect.any(Function))
})
