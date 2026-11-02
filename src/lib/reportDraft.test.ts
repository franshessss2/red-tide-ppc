// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { clearReportDraft, readReportDraft, saveReportDraft } from './reportDraft'
afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })
it('recovers only text for the same zone and backend', () => {
  expect(saveReportDraft('demo', 'bay', 'Unusual water near the shore')).toBe(true)
  expect(readReportDraft('demo', 'bay')).toBe('Unusual water near the shore')
  expect(readReportDraft('firebase', 'bay')).toBe('')
  expect(readReportDraft('demo', 'other')).toBe('')
  clearReportDraft('demo', 'bay')
  expect(readReportDraft('demo', 'bay')).toBe('')
})
it('expires drafts after seven days and tolerates corrupt or blocked storage', () => {
  saveReportDraft('demo', 'bay', 'unfinished')
  expect(readReportDraft('demo', 'bay', Date.now() + 8*86400000)).toBe('')
  localStorage.setItem('red-tide-ppc:report-draft:v1:demo:bay', '{bad')
  expect(readReportDraft('demo', 'bay')).toBe('')
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota') })
  expect(saveReportDraft('demo', 'bay', 'unfinished')).toBe(false)
})
