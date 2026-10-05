// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { useImperativeHandle, type Ref } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import StreetMapExample from './StreetMapExample'
const state = vi.hoisted(() => ({ props: {} as Record<string, unknown>, listeners: {} as Record<string, () => void>, worker: vi.fn() }))
vi.mock('maplibre-gl', () => ({ setWorkerUrl: state.worker }))
vi.mock('@/components/ui/map', () => ({
  Map: ({ ref, children, ...props }: { ref: Ref<unknown>; children: React.ReactNode }) => {
    state.props = props
    useImperativeHandle(ref, () => ({ on: (name: string, cb: () => void) => { state.listeners[name] = cb }, off: vi.fn(), loaded: () => false }))
    return <div data-testid="mapcn-map">{children}</div>
  },
  MapControls: () => <div>Zoom controls</div>,
}))
afterEach(() => { cleanup(); vi.useRealTimers(); state.listeners = {} })
it('uses geographic context with the default tiled style and controls', () => {
  render(<StreetMapExample />)
  expect(state.props).toMatchObject({ center: [118.7353, 9.7392], zoom: 11, theme: 'dark' })
  expect(state.props.blank).toBeUndefined()
  expect(state.props.styles).toBeUndefined()
  expect(screen.getByText('Zoom controls')).toBeTruthy()
})
it('replaces an endless loader after unavailable data and permits the map to be unmounted', () => {
  vi.useFakeTimers(); render(<StreetMapExample />)
  act(() => { vi.advanceTimersByTime(30000) })
  expect(screen.getByRole('status').textContent).toContain('could not load')
  expect(screen.queryByTestId('mapcn-map')).toBeNull()
})
it('keeps a loaded map and reports incomplete data without resetting the viewport', () => {
  vi.useFakeTimers(); render(<StreetMapExample />)
  act(() => { state.listeners.load(); state.listeners.error(); vi.advanceTimersByTime(30000) })
  expect(screen.getByTestId('mapcn-map')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('may be incomplete')
})
