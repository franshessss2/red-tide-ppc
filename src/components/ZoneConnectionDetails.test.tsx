// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { ZoneConnectionDetails } from './ZoneConnectionDetails'

afterEach(cleanup)

it('keeps loading counts unknown, then exposes real counts without an all-clear claim', async () => {
  const user = userEvent.setup()
  const counts = { advisory: 2, unconfirmed: 1, unknown: 3, safe: 1 }
  const { rerender } = render(<ZoneConnectionDetails counts={counts} ready={false} />)
  expect(screen.getByText('Status counts and connection').closest('details')?.open).toBe(false)
  await user.click(screen.getByText('Status counts and connection'))
  expect(screen.getAllByRole('definition').map(node => node.textContent)).toEqual(['—', '—', '—', '—'])
  rerender(<ZoneConnectionDetails counts={counts} ready />)
  expect(screen.getAllByRole('definition').map(node => node.textContent)).toEqual(['2', '1', '3', '1'])
  expect(screen.getByText('Not an official clearance.')).toBeTruthy()
})
