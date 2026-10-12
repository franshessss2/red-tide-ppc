// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AndroidDownloadButton } from './AndroidDownloadButton'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.open = false })
})
afterEach(cleanup)

it('only mounts the QR after opening and offers the same download destination', () => {
  render(<AndroidDownloadButton />)
  expect(screen.queryByRole('img')).toBeNull()
  const trigger = screen.getByRole('button', { name: 'Android app download QR code' })
  fireEvent.click(trigger)
  expect(screen.getByRole('dialog', { name: 'Get Red Tide PPC' })).toBeTruthy()
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  const link = screen.getByRole('link', { name: /Open download folder/ })
  expect(link.getAttribute('href')).toBe('https://drive.google.com/drive/folders/1mpUalyCgYrDXoN8L1KP7WVv11_p-VFSJ?usp=sharing')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  expect(screen.getByText(/Android testing build · Sample data/)).toBeTruthy()
})

it('dismisses on Escape or close and restores scrolling and trigger focus', () => {
  render(<AndroidDownloadButton />)
  const trigger = screen.getByRole('button', { name: 'Android app download QR code' })
  trigger.focus()
  fireEvent.click(trigger)
  expect(document.body.style.overflow).toBe('hidden')
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.body.style.overflow).toBe('')
  expect(document.activeElement).toBe(trigger)
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', { name: 'Close Android download' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it('cleans up a modal on unmount without changing the previous scroll style', () => {
  document.body.style.overflow = 'auto'
  const { unmount } = render(<AndroidDownloadButton />)
  fireEvent.click(screen.getByRole('button', { name: 'Android app download QR code' }))
  unmount()
  expect(document.body.style.overflow).toBe('auto')
  document.body.style.overflow = ''
})
