// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { GitHubCalendar } from './git-hub-calendar'
afterEach(cleanup)
it('shows available report counts and permits keyboard date selection', () => {
  render(<GitHubCalendar data={[{ date: '2026-10-05', count: 2 }]} today="2026-10-06" available />)
  const today = screen.getByRole('button', { name: /October 6, 2026: 0 reports/ })
  today.focus(); fireEvent.keyDown(today, { key: 'ArrowUp' })
  expect((document.activeElement as HTMLElement).dataset.date).toBe('2026-10-05')
  expect(screen.getByRole('button', { name: /October 5, 2026: 2 reports/ }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByRole('button', { name: /October 7, 2026/ })).toBeNull()
  expect(screen.getByText('2 reports in available records')).toBeTruthy()
})
it('distinguishes unavailable records from zero activity', () => {
  render(<GitHubCalendar data={[]} today="2026-10-06" available={false} />)
  expect(screen.getByText('Report history unavailable')).toBeTruthy()
  expect(screen.getByRole('button', { name: /October 6, 2026: data unavailable/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /0 reports/ })).toBeNull()
})
it('expands the history without losing the selected day or announcing hidden future dates', () => {
  render(<GitHubCalendar data={[]} today="2026-10-06" available />)
  const before = screen.getAllByRole('button').length
  fireEvent.change(screen.getByRole('combobox', { name: 'Period' }), { target: { value: '52' } })
  expect(screen.getAllByRole('button').length).toBeGreaterThan(before)
  expect(screen.getAllByRole('button').filter(button => button.tabIndex === 0)).toHaveLength(1)
})
