// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ReportForm } from './ReportForm'
import { ReportCard } from './ReportCard'
import { SEED_ZONES } from '../data/zones'
import { useAppStore } from '../store'
import { readReportDraft } from '../lib/reportDraft'
const prepare = vi.hoisted(() => vi.fn())
vi.mock('../lib/lowDataPhoto', () => ({ prepareReportPhoto: prepare }))
vi.mock('../motion/preferences', () => ({ useReducedMotion: () => true }))
const initial = useAppStore.getState()
const zone = { ...SEED_ZONES[0], lastUpdated: 1 }
const submit = vi.fn<typeof initial.submitReport>().mockResolvedValue(undefined)
beforeEach(() => {
  localStorage.clear(); submit.mockReset().mockResolvedValue(undefined); prepare.mockReset()
  vi.stubGlobal('URL', { createObjectURL: vi.fn((file: File) => `blob:${file.name}`), revokeObjectURL: vi.fn() })
  useAppStore.setState({ backendKind: 'demo', submitReport: submit, formError: null })
})
afterEach(() => { cleanup(); useAppStore.setState(initial); localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const form = () => render(<ReportForm zone={zone} open onClose={vi.fn()} onDismissed={vi.fn()} />)
it('distinguishes a saved outbox report from an acknowledged submission', async () => {
  submit.mockResolvedValueOnce({ delivery: 'saved', id: 'synthetic-receipt' })
  form()
  fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'Synthetic saved observation.' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Submit report' }).closest('form')!)
  await screen.findByRole('heading', { name: 'Saved on this device' })
  expect(screen.queryByText('Salamat!')).toBeNull()
  expect(screen.getByText(/No server receipt yet/)).toBeTruthy()
})
it('restores text after closing/reopening, never auto-submits, and clears it after acknowledgement', async () => {
  const first = form()
  fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'An unfinished coastal observation.' } })
  first.unmount()
  expect(readReportDraft('demo', zone.id)).toBe('An unfinished coastal observation.')
  form()
  expect((screen.getByLabelText('What did you see?') as HTMLTextAreaElement).value).toBe('An unfinished coastal observation.')
  expect(screen.getByText(/Recovered an unfinished draft/)).toBeTruthy()
  expect(submit).not.toHaveBeenCalled()
  fireEvent.submit(screen.getByRole('button', { name: 'Submit report' }).closest('form')!)
  await screen.findByText('Salamat!')
  cleanup()
  expect(readReportDraft('demo', zone.id)).toBe('')
})
it('discards saved text explicitly without submitting', () => {
  form()
  fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'Unfinished observation.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Clear saved text' }))
  expect((screen.getByLabelText('What did you see?') as HTMLTextAreaElement).value).toBe('')
  expect(readReportDraft('demo', zone.id)).toBe('')
  expect(submit).not.toHaveBeenCalled()
})
it('ignores an older photo preparation result when a newer selection finishes first', async () => {
  let firstDone!: (value: unknown) => void
  prepare.mockImplementationOnce(() => new Promise(resolve => { firstDone = resolve }))
  const secondFile = new File(['small'], 'second.jpg', { type: 'image/jpeg' })
  prepare.mockResolvedValueOnce({ file: secondFile, originalBytes: 2000000, width: 1000, height: 800 })
  form()
  const input = document.querySelector('input[type="file"]')!
  fireEvent.change(input, { target: { files: [new File(['first'], 'first.jpg', { type: 'image/jpeg' })] } })
  expect((screen.getByRole('button', { name: 'Submit report' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(input, { target: { files: [secondFile] } })
  await screen.findByText('Low-data photo ready')
  firstDone({ file: new File(['old'], 'old.jpg'), originalBytes: 100, width: 100, height: 100 })
  await waitFor(() => expect(screen.getByAltText('Selected report attachment').getAttribute('src')).toBe('blob:second.jpg'))
  expect(screen.queryByText('old.jpg')).toBeNull()
})
it('passes a trimmed public review note with the admin decision', async () => {
  const approve = vi.fn(async () => {})
  render(<ReportCard report={{ id: 'r', zoneId: zone.id, description: 'Synthetic observation.', photoUrl: null, status: 'pending', submittedAt: 1 }} zoneName={zone.name} busy={false} onApprove={approve} onReject={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Public review note (optional)'), { target: { value: '  Checked the community observation.  ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Approve → advisory' }))
  await waitFor(() => expect(approve).toHaveBeenCalledExactlyOnceWith('Checked the community observation.'))
})
