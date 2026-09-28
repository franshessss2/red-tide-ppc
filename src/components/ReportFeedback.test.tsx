// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SEED_ZONES } from '../data/zones'
import { reportSuccessMessage } from '../lib/reportFeedback'
import { useAppStore } from '../store'
import type { Report, Zone } from '../types'
import { ReportForm } from './ReportForm'
import { ReportCard } from './ReportCard'
import { Notice } from './Notice'
vi.mock('../motion/preferences', () => ({ useReducedMotion: () => true }))
const zone: Zone = { ...SEED_ZONES[0], polygon: [...SEED_ZONES[0].polygon], lastUpdated: 0 }
const report: Report = { id: 'review-test', zoneId: zone.id, description: 'Demo observation near the shore.', photoUrl: null, status: 'pending', submittedAt: 0 }
const originalSubmit = useAppStore.getState().submitReport
beforeEach(() => useAppStore.setState({ formError: null, error: null, notice: null }))
afterEach(() => { cleanup(); useAppStore.setState({ submitReport: originalSubmit, error: null, notice: null }); vi.restoreAllMocks() })
function deferred() { let resolve!: () => void; let reject!: (error: Error) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function form(submit = vi.fn(async () => {})) {
  useAppStore.setState({ submitReport: submit })
  const onDismissed = vi.fn()
  const result = render(<ReportForm zone={zone} open onClose={vi.fn()} onDismissed={onDismissed} />)
  fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'Demo observation near the shore.' } })
  const node = screen.getByRole('button', { name: 'Submit report' }).closest('form')!
  return { ...result, node, onDismissed }
}
describe('report feedback ownership', () => {
  it('submits once under repeated submit events, and shows no early success', async () => {
    const task = deferred(), submit = vi.fn(() => task.promise)
    const { node } = form(submit)
    fireEvent.submit(node); fireEvent.submit(node)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Salamat!')).toBeNull()
    await act(async () => task.resolve())
    expect(await screen.findByText('Salamat!')).toBeTruthy()
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Report sent')
  })
  it('returns to an editable form after failure and permits one retry', async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(undefined)
    const { node } = form(submit)
    fireEvent.submit(node)
    await waitFor(() => expect((screen.getByRole('button', { name: 'Submit report' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.submit(node)
    await screen.findByText('Salamat!')
    expect(submit).toHaveBeenCalledTimes(2)
  })
  it('does not resurrect or dismiss a form after its async request outlives unmount', async () => {
    const task = deferred()
    const { node, unmount, onDismissed } = form(vi.fn(() => task.promise))
    fireEvent.submit(node); unmount()
    await act(async () => task.resolve())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Salamat!')).toBeNull()
    expect(onDismissed).not.toHaveBeenCalled()
  })
  it('traps keyboard focus and restores the opener and background on unmount', () => {
    const opener = document.createElement('button'); opener.textContent = 'Open'; document.body.append(opener); opener.focus()
    const previousInert = opener.inert
    const { unmount } = form()
    expect(opener.inert).toBe(true)
    screen.getByRole('button', { name: 'Submit report' }).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByLabelText('What did you see?'))
    unmount()
    expect(opener.inert).toBe(previousInert)
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
  it('consumes the exact duplicate notice without rendering a second confirmation', () => {
    const message = reportSuccessMessage(zone.name)
    useAppStore.setState({ notice: message })
    render(<Notice suppressNotice={message} />)
    expect(screen.queryByText(message)).toBeNull()
    expect(useAppStore.getState().notice).toBeNull()
  })
  it('preserves concurrent errors and unrelated notices', () => {
    useAppStore.setState({ notice: 'Other action completed.', error: 'Could not load zones.' })
    const { rerender } = render(<Notice suppressNotice={reportSuccessMessage(zone.name)} />)
    expect(screen.getByRole('alert').textContent).toContain('Could not load zones.')
    expect(useAppStore.getState().notice).toBe('Other action completed.')
    act(() => useAppStore.setState({ error: null }))
    rerender(<Notice suppressNotice={reportSuccessMessage(zone.name)} />)
    expect(screen.getByText('Other action completed.')).toBeTruthy()
  })
})
describe('review action lifecycle', () => {
  it('starts approval immediately, locks both controls, and retries after a rejected promise', async () => {
    const task = deferred(), approve = vi.fn(() => task.promise), reject = vi.fn()
    render(<ReportCard report={report} zoneName={zone.name} busy={false} onApprove={approve} onReject={reject} />)
    const approveButton = screen.getByRole('button', { name: 'Approve → advisory' })
    fireEvent.click(approveButton); fireEvent.click(approveButton)
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(approve).toHaveBeenCalledTimes(1)
    expect(reject).not.toHaveBeenCalled()
    expect(screen.queryByText('Approved')).toBeNull()
    await act(async () => task.reject(new Error('Offline')))
    expect((screen.getByRole('button', { name: 'Approve → advisory' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('does not replay approval when callback identity changes during a write', async () => {
    const task = deferred(), first = vi.fn(() => task.promise), second = vi.fn()
    const { rerender, unmount } = render(<ReportCard report={report} zoneName={zone.name} busy={false} onApprove={first} onReject={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Approve → advisory' }))
    rerender(<ReportCard report={report} zoneName={zone.name} busy onApprove={second} onReject={vi.fn()} />)
    unmount()
    await act(async () => task.resolve())
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })
})
