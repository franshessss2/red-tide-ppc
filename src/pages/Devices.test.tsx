// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Devices } from './Devices'
import { DEVICE_ID, DEVICE_ZONE } from '../devices/model'

const reading = { deviceId: DEVICE_ID, zoneId: DEVICE_ZONE, sessionId: 'test-boot-123', sequence: 0,
  temperatureC: 29, cloudinessPercent: 42, source: 'wokwi', receivedAt: Date.now() }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
const mount = () => render(<MemoryRouter><Devices /></MemoryRouter>)

describe('device dashboard', () => {
  it('offers setup and local rehearsal when the endpoint is unconfigured', async () => {
    const mock = vi.fn().mockImplementation(async () => Response.json({ configured: false, readings: [] }))
    vi.stubGlobal('fetch', mock)
    mount()
    await screen.findByText('Connection not configured')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Local rehearsal' }))
    const calls = mock.mock.calls.length
    fireEvent.change(screen.getByLabelText(/Temperature:/), { target: { value: '31.5' } })
    await user.click(screen.getByRole('button', { name: 'Send local reading' }))
    expect(screen.getAllByText('31.5 °C').length).toBe(2)
    expect(screen.getByText('Local rehearsal · browser only')).toBeTruthy()
    expect(mock.mock.calls.length).toBe(calls)
    await user.click(screen.getByRole('button', { name: 'Wokwi connection' }))
    await screen.findByText('Connection not configured')
    expect(screen.queryByText('31.5 °C')).toBeNull()
  })
  it('shows received readings and preserves them through a failed refresh', async () => {
    const mock = vi.fn().mockResolvedValueOnce(Response.json({ configured: true, readings: [reading] }))
      .mockResolvedValueOnce(Response.json({ error: 'outage' }, { status: 503 }))
    vi.stubGlobal('fetch', mock); mount()
    await screen.findByText('Receiving readings')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh readings' }))
    await screen.findByText('Connection unavailable')
    expect(screen.getAllByText('29.0 °C').length).toBe(2)
    expect(screen.getByRole('alert').textContent).toContain('stale')
  })
  it('rejects an HTML SPA fallback as a connection failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } })))
    mount(); await screen.findByText('Connection unavailable')
  })
  it('aborts an in-flight poll when unmounted', async () => {
    let signal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((_url, options) => { signal = options.signal; return new Promise(() => {}) }))
    const view = mount(); await waitFor(() => expect(signal).toBeDefined())
    view.unmount(); expect(signal?.aborted).toBe(true)
  })
  it('pauses requests while hidden and refreshes on return', async () => {
    const mock = vi.fn().mockResolvedValue(Response.json({ configured: true, readings: [] }))
    vi.stubGlobal('fetch', mock); mount()
    await screen.findByText('Waiting for readings')
    vi.useFakeTimers()
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange'))
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(mock).toHaveBeenCalledTimes(1)
    hidden.mockReturnValue(false)
    await act(async () => { fireEvent(document, new Event('visibilitychange')); await Promise.resolve() })
    expect(mock).toHaveBeenCalledTimes(2)
    hidden.mockRestore()
  })
})
