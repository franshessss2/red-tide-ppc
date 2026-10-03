// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataProvenance, MapFeedStatus } from './DataProvenance'
import { emptyFeed } from '../lib/feed'
import { useAppStore } from '../store'

beforeEach(() => useAppStore.setState({ backendKind: 'firebase', zonesReady: true, reportsReady: true,
  zonesFeed: { ...emptyFeed(), phase: 'synced' }, reportsFeed: { ...emptyFeed(), phase: 'synced' } }))
afterEach(cleanup)

describe('data provenance', () => {
  it('distinguishes sample data and never presents a local copy as server synced', () => {
    useAppStore.setState({ backendKind: 'demo', zonesFeed: { ...emptyFeed(), phase: 'sample' }, reportsFeed: { ...emptyFeed(), phase: 'sample' } })
    render(<DataProvenance />)
    expect(screen.getByText('Sample data')).toBeTruthy()
    expect(screen.queryByText(/Last server sync/)).toBeNull()
    expect(screen.getByRole('link', { name: /BFAR bulletins/ }).getAttribute('href')).toContain('shellfishBulletinFile')
  })

  it('shows delivery time separately from status age and never adds another live region', () => {
    useAppStore.setState({ zonesFeed: { phase: 'synced', lastSyncedAt: 1700000000000, error: null } })
    render(<DataProvenance />)
    expect(screen.getByText(/Last server sync:/)).toBeTruthy()
    expect(screen.getByText('Server sync describes delivery, not when the coast was tested.')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('keeps a report failure visible when the zone feed is healthy and retries only reports', () => {
    const retry = vi.spyOn(useAppStore.getState(), 'retryFeeds')
    useAppStore.setState({ reportsFeed: { ...emptyFeed(), phase: 'error', error: 'Denied' } })
    render(<MapFeedStatus />)
    expect(screen.getByText(/Showing last received records/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry reports' }))
    expect(retry).toHaveBeenCalledWith('reports')
    retry.mockRestore()
  })
})
