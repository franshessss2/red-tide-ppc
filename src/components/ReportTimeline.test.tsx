// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ReportTimeline } from './ReportTimeline'
import type { Report, Zone } from '../types'
const report: Report = { id: 'r', zoneId: 'bay', status: 'pending', submittedAt: 1000, description: 'Synthetic record', photoUrl: null }
const zone: Zone = { id: 'bay', name: 'Bay', status: 'safe', lastUpdated: 2000, description: '', polygon: [] }
afterEach(cleanup)
it('keeps a green-zone pending report pending instead of inventing an archive or a review', () => {
  render(<ReportTimeline report={report} zone={zone} />)
  expect(screen.getByText(/still awaiting review/)).toBeTruthy()
  expect(screen.queryByText('Approved by admin')).toBeNull()
  expect(screen.getByText('Admin review').closest('li')?.getAttribute('aria-current')).toBe('step')
  expect(screen.getByText('Kept in report history').closest('li')?.getAttribute('data-state')).toBe('future')
  expect(report.status).toBe('pending')
})
it('shows a real review decision while leaving an older missing review date unavailable', () => {
  const view = render(<ReportTimeline report={{ ...report, status: 'confirmed' }} />)
  expect(screen.getByText('Approved by admin')).toBeTruthy()
  expect(screen.getByText('Review: Date unavailable')).toBeTruthy()
  view.rerender(<ReportTimeline report={{ ...report, status: 'rejected', reviewedAt: null, reviewedAtPending: true }} />)
  expect(screen.getByText('Rejected by admin').closest('li')?.getAttribute('aria-current')).toBe('step')
  expect(screen.getByText('Review: Awaiting server timestamp')).toBeTruthy()
})
