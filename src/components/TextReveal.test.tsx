// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TextReveal } from './TextReveal'
let reduced = false
vi.mock('../motion/preferences', () => ({ useReducedMotion: () => reduced }))
afterEach(() => { cleanup(); reduced = false })
describe('TextReveal', () => {
  it('keeps one accessible heading and breakable spaces across words', () => {
    const { container } = render(<TextReveal as="h1" text="Follow community warnings" effect="words" trigger="mount" />)
    expect(screen.getByRole('heading', { name: 'Follow community warnings' })).toBeTruthy()
    expect(container.textContent).toBe('Follow community warnings')
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(3)
    expect(container.textContent).not.toContain('\u00a0')
  })
  it('renders ordinary visible text with no animated segments for reduced motion', () => {
    reduced = true
    const { container } = render(<TextReveal as="h2" text="Coastal device" />)
    expect(screen.getByRole('heading', { name: 'Coastal device' })).toBeTruthy()
    expect(container.querySelector('[aria-hidden]')).toBeNull()
    expect(container.querySelector('h2')?.style.opacity).toBe('')
  })
})
