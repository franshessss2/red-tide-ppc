// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyFeed } from '../lib/feed'
import { LiveDataStatus } from './LiveDataStatus'
import { useAppStore } from '../store'
import type { Report, Zone } from '../types'

const zones: Zone[] = [
  { id: 'a', name: 'City Bay', description: '', polygon: [], status: 'safe', lastUpdated: 1 },
  { id: 'b', name: 'Honda Bay', description: '', polygon: [], status: 'advisory', lastUpdated: 1 },
]
const report: Report = { id: 'r1', zoneId: 'a', description: 'Red water', photoUrl: null, submittedAt: 1, status: 'pending' }
const region = () => screen.getByRole('status', { name: 'Live coastal data' })
const settle = () => act(() => { vi.advanceTimersByTime(250) })

beforeEach(() => {
  vi.useFakeTimers()
  useAppStore.setState({ zones, reports: [report], zonesReady: true, reportsReady: true, zonesFeed: { ...emptyFeed(), phase: 'synced' }, reportsFeed: { ...emptyFeed(), phase: 'synced' } })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('LiveDataStatus', () => {
  it('mounts an empty persistent, polite and atomic region before publishing ready data', () => {
    render(<LiveDataStatus />)
    const node = region()
    expect(node.textContent).toBe('')
    expect(node.getAttribute('aria-live')).toBe('polite')
    expect(node.getAttribute('aria-atomic')).toBe('true')
    settle()
    expect(region()).toBe(node)
    expect(node.textContent).toBe('2 zone records. 1 community warnings. 0 under review. 1 with no alert recorded. 0 status unavailable. 1 pending reports. Zones: Server snapshot received. Reports: Server snapshot received.')
  })

  it('announces ready zone data without waiting for reports or announcing placeholder zeroes', () => {
    useAppStore.setState({ zonesReady: false, reportsReady: false })
    render(<LiveDataStatus />)
    settle()
    expect(region().textContent).toBe('')
    act(() => useAppStore.setState({ zonesReady: true }))
    settle()
    expect(region().textContent).toContain('1 community warnings')
    expect(region().textContent).toContain('Report data loading.')
    expect(region().textContent).not.toContain('pending reports')
    act(() => useAppStore.setState({ reportsReady: true }))
    settle()
    expect(region().textContent).toContain('1 pending reports')
  })

  it('coalesces report and zone updates, with contextual per-zone and zero-count text', () => {
    render(<LiveDataStatus />)
    settle()
    act(() => useAppStore.setState({ reports: [{ ...report, status: 'confirmed' }] }))
    act(() => vi.advanceTimersByTime(100))
    expect(region().textContent).toContain('1 pending reports')
    act(() => useAppStore.setState({ zones: zones.map((z) => ({ ...z, status: 'advisory' })) }))
    settle()
    expect(region().textContent).toContain('2 community warnings')
    expect(region().textContent).toContain('0 pending reports')
    expect(region().textContent).toContain('City Bay: Community warning. 0 pending reports.')
  })

  it('announces zone changes even when all aggregate totals stay the same', () => {
    render(<LiveDataStatus />)
    settle()
    act(() => useAppStore.setState({ zones: [{ ...zones[0], status: 'advisory' }, { ...zones[1], status: 'safe' }] }))
    settle()
    expect(region().textContent).toContain('1 community warnings')
    expect(region().textContent).toContain('City Bay: Community warning. 1 pending reports.')
    expect(region().textContent).toContain('Honda Bay: No alert recorded. 0 pending reports.')
  })

  it('announces an unconfirmed count and per-zone pending redistribution', () => {
    render(<LiveDataStatus />)
    settle()
    act(() => useAppStore.setState({ zones: [{ ...zones[0], status: 'unconfirmed' }, zones[1]], reports: [{ ...report, zoneId: 'b' }] }))
    settle()
    expect(region().textContent).toContain('1 under review')
    expect(region().textContent).toContain('City Bay: Under review. 0 pending reports.')
    expect(region().textContent).toContain('Honda Bay: Community warning. 1 pending reports.')
  })

  it('announces removals and the transition to no zones', () => {
    render(<LiveDataStatus />)
    settle()
    act(() => useAppStore.setState({ zones: [], reports: [] }))
    settle()
    expect(region().textContent).toContain('No zone records available.')
    expect(region().textContent).toContain('Zone removed from watch: City Bay.')
  })

  it('does not repeat an announcement for timestamp or description-only changes', () => {
    render(<LiveDataStatus />)
    settle()
    act(() => useAppStore.setState({ reports: [] }))
    settle()
    const message = region().textContent
    act(() => useAppStore.setState({ zones: zones.map((z) => ({ ...z, lastUpdated: 999, description: 'Updated copy' })) }))
    settle()
    expect(region().textContent).toBe(message)
  })

  it('includes total and reviewed counts in the admin channel only', () => {
    render(<LiveDataStatus admin />)
    settle()
    expect(region().textContent).toContain('1 total reports. 0 reviewed reports.')
    act(() => useAppStore.setState({ reports: [{ ...report, status: 'rejected' }] }))
    settle()
    expect(region().textContent).toContain('1 total reports. 1 reviewed reports.')
  })

  it('cleans up a pending announcement on unmount', () => {
    const { unmount } = render(<LiveDataStatus />)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('announces metadata changes once without announcing repeated receipt times', () => {
    useAppStore.setState({ zonesFeed: { ...emptyFeed(), phase: 'cached' } })
    render(<LiveDataStatus />)
    settle()
    expect(region().textContent).toContain('Cached copy · server not verified')
    act(() => useAppStore.setState({ zonesFeed: { phase: 'synced', lastSyncedAt: 1000, error: null } }))
    settle()
    const message = region().textContent
    expect(message).toContain('Server snapshot received')
    act(() => useAppStore.setState({ zonesFeed: { phase: 'synced', lastSyncedAt: 2000, error: null } }))
    settle()
    expect(region().textContent).toBe(message)
  })

  it('announces an initial feed failure even when neither feed is ready', () => {
    useAppStore.setState({ zones: [], reports: [], zonesReady: false, reportsReady: false,
      zonesFeed: { ...emptyFeed(), phase: 'error', error: 'Unavailable' }, reportsFeed: emptyFeed() })
    render(<LiveDataStatus />)
    settle()
    expect(region().textContent).toContain('Zones: Updates unavailable')
    expect(region().textContent).not.toContain('0 community warnings')
  })

  it('announces unknown records as unavailable rather than no alert', () => {
    render(<LiveDataStatus />)
    settle()
    act(() => useAppStore.setState({ zones: [{ ...zones[0], status: 'unknown', lastUpdated: null }, zones[1]] }))
    settle()
    expect(region().textContent).toContain('1 status unavailable')
    expect(region().textContent).toContain('City Bay: Status unavailable.')
  })
})
