// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StreetMapDialog } from './StreetMapDialog'
vi.mock('./StreetMapExample', () => ({ default: () => <div>Street map example</div> }))
vi.mock('../motion/preferences', () => ({ useReducedMotion: () => true }))
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function(this: HTMLDialogElement) { this.open = true })
  HTMLDialogElement.prototype.close = vi.fn(function(this: HTMLDialogElement) { this.open = false })
})
afterEach(cleanup)
it('opens a named modal and dismisses on close and Escape', async () => {
  const onClose = vi.fn()
  const { container } = render(<StreetMapDialog onClose={onClose} />)
  await waitFor(() => expect(screen.getByText('Street map example')).toBeTruthy())
  expect(container.querySelector('dialog')?.open).toBe(true)
  expect(screen.getByRole('dialog', { name: 'Street map' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Close street map' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  fireEvent(container.querySelector('dialog')!, new Event('cancel', { bubbles: false, cancelable: true }))
  expect(onClose).toHaveBeenCalledTimes(2)
})
it('restores keyboard focus to its opener on unmount', () => {
  const opener = document.createElement('button'); document.body.append(opener); opener.focus()
  const { unmount } = render(<StreetMapDialog onClose={() => {}} />)
  unmount()
  expect(document.activeElement).toBe(opener)
  opener.remove()
})
