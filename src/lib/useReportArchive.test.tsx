// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useReportArchive } from './useReportArchive'
import { setBackendForTesting, type Backend } from './backend'
import { useAppStore } from '../store'
import type { Report } from '../types'
const initial = useAppStore.getState()
const report = (id: string): Report => ({ id, zoneId: 'pp-bay', description: 'Synthetic history.', photoUrl: null, submittedAt: 1, status: 'confirmed' })
afterEach(() => { cleanup(); setBackendForTesting(null); useAppStore.setState(initial) })
it('retries the same cursor after a failure and keeps records when the live boundary advances', async () => {
  const page = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ records: [report('older')], cursor: 'next', hasMore: false })
  setBackendForTesting({ kind: 'demo', reportPage: page } as unknown as Backend)
  useAppStore.setState({ backendKind: 'demo', reports: [report('boundary')], reportsCursor: 'anchor', reportsHasMore: true })
  const { result } = renderHook(useReportArchive)
  await act(async () => { await result.current.load() })
  expect(result.current.error).toBe('Offline')
  await act(async () => { await result.current.load() })
  expect(page.mock.calls).toEqual([['anchor', false], ['anchor', false]])
  act(() => useAppStore.setState({ reports: [report('newest')] }))
  expect(new Set(result.current.records.map(item => item.id))).toEqual(new Set(['boundary', 'older', 'newest']))
  expect(result.current.hasMore).toBe(false)
})
it('ignores an old request after switching to the all-records legacy archive', async () => {
  let finish!: (page: unknown) => void
  const page = vi.fn(() => new Promise(resolve => { finish = resolve }))
  setBackendForTesting({ kind: 'demo', reportPage: page } as unknown as Backend)
  useAppStore.setState({ backendKind: 'demo', reports: [report('current')], reportsCursor: 'anchor', reportsHasMore: true })
  const { result } = renderHook(useReportArchive)
  let pending!: Promise<void>
  act(() => { pending = result.current.load() })
  act(() => result.current.setAllRecords(true))
  await act(async () => { finish({ records: [report('obsolete')], hasMore: false }); await pending })
  expect(result.current.records).toEqual([])
  expect(result.current.loading).toBe(false)
})
