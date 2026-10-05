// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { MobileMapPanel, type MobilePanelState } from './MobileMapPanel'
import { MobileMapActions } from './MobileMapActions'

vi.mock('./ZoneDrawer', () => ({
  AdvisoryBanner: () => <p>Community warning details</p>,
  Primer: () => <p>Coastal primer</p>,
  ZoneCardItem: () => null,
}))
vi.mock('./DataProvenance', () => ({
  DataProvenance: () => <p>Data source</p>,
}))
afterEach(cleanup)
function Panel({
  ready = true,
  counts = { safe: 7, advisory: 0, unconfirmed: 0, unknown: 0 },
} = {}) {
  const [state, setState] = useState<MobilePanelState>('peek')
  return (
    <MobileMapPanel
      state={state}
      onStateChange={setState}
      zones={[]}
      zonesReady={ready}
      reportsReady={ready}
      counts={counts}
      pendingCounts={{}}
      pending={0}
      selectedZoneId={null}
      onFocusZone={() => {}}
      onReport={() => {}}
    />
  )
}
describe('mobile map information', () => {
  it('starts with one summary; collapsed details cannot receive focus', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    const toggle = screen.getByRole('button', { name: /0 zones/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Data source')).toBeNull()
    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Data source')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Expand panel' }))
    expect(screen.getByRole('button', { name: 'Smaller panel' })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle)
  })
  it('keeps incomplete records distinct from zero warnings', async () => {
    const user = userEvent.setup()
    render(<Panel ready={false} />)
    await user.click(
      screen.getByRole('button', { name: /Zone records loading/ }),
    )
    expect(
      screen.getAllByRole('definition').map((el) => el.textContent),
    ).toEqual(['—', '—', '—', '—'])
    expect(screen.getByText('Report records loading')).toBeTruthy()
  })
  it('provides keyboard expansion and collapse', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    const toggle = screen.getByRole('button', { name: /0 zones/ })
    toggle.focus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('button', { name: 'Smaller panel' })).toBeTruthy()
    await user.keyboard('{ArrowDown}')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })
})
describe('mobile map options', () => {
  it('closes after an action, outside tap and Escape', async () => {
    const user = userEvent.setup()
    const action = vi.fn()
    render(
      <>
        <MobileMapActions>
          <button onClick={action}>Reset</button>
        </MobileMapActions>
        <button>Outside</button>
      </>,
    )
    const toggle = screen.getByRole('button', { name: 'Map options' })
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(action).toHaveBeenCalledOnce()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Outside' }))
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await user.click(toggle)
    await user.keyboard('{Escape}')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle)
  })
})
