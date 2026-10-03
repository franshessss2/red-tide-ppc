// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ZoneStatus } from '../types'
import { StatusKey } from './StatusKey'

/**
 * Phase-2 pill-row motion wiring: the shared layoutId indicator lives in
 * exactly one chip (the active status), and critical counts appear immediately. The slide itself is measured in the real-browser pass;
 * here we pin the DOM contract.
 */

const COUNTS: Record<ZoneStatus, number> = {
  safe: 4,
  unconfirmed: 1,
  advisory: 1,
  unknown: 0,
}

afterEach(() => {
  cleanup()
})

function chipFor(container: HTMLElement, status: ZoneStatus): HTMLElement {
  const chip = container.querySelector(`[data-status="${status}"]`)
  expect(chip).toBeTruthy()
  return chip as HTMLElement
}

describe('shared active indicator', () => {
  it('rests on the worst non-zero status by default', () => {
    const { container } = render(<StatusKey counts={COUNTS} />)
    expect(chipFor(container, 'advisory').querySelector('[data-testid="status-key-indicator"]')).toBeTruthy()
    expect(chipFor(container, 'safe').querySelector('[data-testid="status-key-indicator"]')).toBeNull()
    expect(chipFor(container, 'unconfirmed').querySelector('[data-testid="status-key-indicator"]')).toBeNull()
  })

  it('moves to the selected zone status and stays singular', async () => {
    const { container, rerender } = render(
      <StatusKey counts={COUNTS} activeStatus="advisory" />,
    )
    rerender(<StatusKey counts={COUNTS} activeStatus="safe" />)

    await waitFor(() => {
      expect(
        chipFor(container, 'safe').querySelector('[data-testid="status-key-indicator"]'),
      ).toBeTruthy()
    })
    // Exactly ONE indicator in the whole row — it is a shared element.
    expect(
      container.querySelectorAll('[data-testid="status-key-indicator"]'),
    ).toHaveLength(1)
  })
})

describe('immediate critical counts', () => {
  it('shows the final count on the same render as a status update', () => {
    const { container, rerender } = render(<StatusKey counts={COUNTS} />)
    rerender(<StatusKey counts={{ ...COUNTS, safe: 7 }} />)
    const count = chipFor(container, 'safe').querySelector('.font-mono')!
    expect(count.textContent).toBe('7')
    expect(count.hasAttribute('aria-hidden')).toBe(false)
    expect(chipFor(container, 'safe').querySelector('.sr-only')).toBeNull()
  })
  it('does not show zero counts while records are still loading', () => {
    const { container } = render(<StatusKey counts={COUNTS} ready={false} />)
    expect(chipFor(container, 'safe').querySelector('.font-mono')?.textContent).toBe('—')
  })
})
