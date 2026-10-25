// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ReelStage, ReportPreview } from './ReelStage'
import { REEL_SCENES } from './reelScenes'
afterEach(cleanup)
describe('Connected Coast illustrations', () => {
  it.each(REEL_SCENES.map((copy, scene) => ({ ...copy, scene })))('presents chapter $chapter with its accessible explanation', ({ scene, title, description }) => {
    render(<ReelStage scene={scene} reduced={false} />)
    expect(screen.getByRole('heading', { name: title })).toBeTruthy()
    expect(screen.getByText(description)).toBeTruthy()
  })
  it('shows exactly seven zone LEDs and three system LEDs without obsolete hardware', () => {
    const view = render(<ReelStage scene={4} reduced={false} />)
    expect(view.container.querySelectorAll('[data-led-role]')).toHaveLength(10)
    expect(view.container.querySelectorAll('[data-led-role="zone"]')).toHaveLength(7)
    for (const role of ['warning', 'heartbeat', 'stale']) expect(view.container.querySelector(`[data-led-role="${role}"]`)).toBeTruthy()
    expect(screen.getByText(/not a red-tide detector/)).toBeTruthy()
    expect(screen.queryByText(/Manual beep|Distance scan/)).toBeNull()
    expect(view.container.querySelector('button')).toBeNull()
    expect(view.container.querySelector('.coast-hardware')?.getAttribute('aria-hidden')).toBe('true')
  })
  it('labels the example and keeps observation content inside one decorative card', () => {
    const view = render(<ReportPreview />)
    const field = view.container.querySelector('.reel-report__field')!
    expect(field.children.length).toBe(1)
    expect(field.textContent).toBe('Unusual water colour')
    expect(screen.getByText('ILLUSTRATION')).toBeTruthy()
    expect(screen.getByText('Awaiting admin review')).toBeTruthy()
    expect(screen.getByText(/Never an automatic clearance/)).toBeTruthy()
    expect(view.container.querySelector('.coast-workflow')?.getAttribute('aria-hidden')).toBe('true')
  })
  it('shows the closing product message and equivalent information under reduced motion', () => {
    const view = render(<ReelStage scene={1} reduced />)
    expect(screen.getByRole('heading', { name: 'RED TIDE' })).toBeTruthy()
    expect(view.container.querySelector('.reel-report')).toBeNull()
    expect(screen.getByText(/Reports are reviewed by an admin/)).toBeTruthy()
  })
})
