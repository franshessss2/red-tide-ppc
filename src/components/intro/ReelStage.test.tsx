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
  it('keeps the intro focused on community reporting without the Arduino chapter', () => {
    expect(REEL_SCENES.map(scene => scene.chapter)).toEqual(['Our coast', 'Your observation', 'Human review', 'Shared updates', 'Your turn'])
    const view = render(<ReelStage scene={REEL_SCENES.length - 1} reduced />)
    expect(screen.getByRole('heading', { name: 'RED TIDE' })).toBeTruthy()
    expect(screen.queryByText(/Arduino|ten lights|FROM SCREEN TO BOARD/i)).toBeNull()
    expect(view.container.querySelector('[data-led-role], .coast-hardware')).toBeNull()
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
    expect(screen.getByRole('region', { name: 'Collaborators' })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Department of Information and Communications Technology/ }).getAttribute('src')).toBe('/media/acknowledgements/dict-philippines.png')
  })
  it('keeps the requested DICT and BFAR logos on the closing chapter', () => {
    const view = render(<ReelStage scene={0} reduced={false} />)
    expect(screen.queryByRole('region', { name: 'Collaborators' })).toBeNull()
    view.rerender(<ReelStage scene={REEL_SCENES.length - 1} reduced={false} />)
    expect(screen.getByRole('region', { name: 'Collaborators' })).toBeTruthy()
    expect(screen.getByText('In collaboration with')).toBeTruthy()
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByRole('img', { name: /Bureau of Fisheries and Aquatic Resources/ })).toBeTruthy()
  })
})
