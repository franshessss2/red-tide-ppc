// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ZoneHistory } from './ZoneHistory'
import { createDemoBackend } from '../lib/backend.demo'
import { setBackendForTesting, type Backend } from '../lib/backend'
import { useAppStore } from '../store'
import { SEED_ZONES } from '../data/zones'

const initial = useAppStore.getState()
afterEach(() => { cleanup(); setBackendForTesting(null); useAppStore.setState(initial); localStorage.clear() })

it('filters history and retries a failed feed without accepting callbacks from the old subscription', () => {
  const subscribe = vi.fn<NonNullable<Backend['subscribeToZoneChanges']>>()
  const stops = [vi.fn(), vi.fn()]
  subscribe.mockReturnValueOnce(stops[0]).mockReturnValueOnce(stops[1])
  setBackendForTesting({ ...createDemoBackend(), subscribeToZoneChanges: subscribe })
  useAppStore.setState({ backendKind: 'demo', zones: SEED_ZONES.map(zone => ({ ...zone, lastUpdated: 1 })) })
  const view = render(<ZoneHistory />)
  act(() => subscribe.mock.calls[0][1]!(new Error('Offline')))
  expect(screen.getByRole('alert').textContent).toContain('could not load')
  expect(screen.queryByText(/No recorded status changes/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry history' }))
  expect(stops[0]).toHaveBeenCalledOnce()
  act(() => subscribe.mock.calls[0][0]([]))
  expect(screen.getByRole('status').textContent).toContain('Loading')
  act(() => subscribe.mock.calls[1][0](SEED_ZONES.slice(0, 2).map((zone, index) => ({
    id: String(index), zoneId: zone.id, fromStatus: 'advisory', toStatus: 'safe', note: `Closing note ${index}`, changedAt: index + 1, reportId: null,
  }))))
  expect(screen.getByText('Closing note 0')).toBeTruthy()
  expect(screen.getByText('Closing note 1')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Filter zone history'), { target: { value: SEED_ZONES[0].id } })
  expect(screen.queryByText('Closing note 1')).toBeNull()
  view.unmount()
  expect(stops[1]).toHaveBeenCalledOnce()
})
