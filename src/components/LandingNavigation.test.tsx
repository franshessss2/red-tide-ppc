// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LandingNavigation } from './LandingNavigation'
import { useState } from 'react'

vi.mock('../App', () => ({ prefetchMapPage: vi.fn() }))
afterEach(cleanup)

it('keeps secondary actions hidden until expanded and closes when keyboard focus leaves navigation', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><LandingNavigation onReplay={vi.fn()} /><button>Outside</button></MemoryRouter>)
  expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Watch introduction' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Map' }).textContent).toBe('Map')
  const trigger = screen.getByRole('button', { name: 'More options' })
  const panel = document.getElementById(trigger.getAttribute('aria-controls')!)!
  expect(panel.hasAttribute('inert')).toBe(true)
  await user.click(trigger)
  expect(panel.hasAttribute('inert')).toBe(false)
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Watch introduction' }))
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Arduino diagnostics' }))
  expect(document.activeElement?.getAttribute('href')).toBe('/arduino.html')
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Admin' }))
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Outside' }))
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(panel.hasAttribute('inert')).toBe(true)
  expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull()
})

it('keeps Map and QR available and closes secondary navigation on Escape and outside tap', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><LandingNavigation /><button>Outside</button></MemoryRouter>)
  expect(screen.getByRole('link', { name: /Map/ }).getAttribute('href')).toBe('/map')
  expect(screen.getByRole('button', { name: 'Android app download QR code' })).toBeTruthy()
  const trigger = screen.getByRole('button', { name: 'More options' })
  await user.click(trigger)
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin')
  await user.keyboard('{Escape}')
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(trigger)
  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: 'Outside' }))
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})

it('retains the replay control for the existing introduction focus return', async () => {
  const user = userEvent.setup()
  const replay = vi.fn()
  render(<MemoryRouter><LandingNavigation onReplay={replay} /></MemoryRouter>)
  const trigger = screen.getByRole('button', { name: 'More options' })
  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: 'Watch introduction' }))
  expect(replay).toHaveBeenCalledOnce()
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
})

it('leaves the focus-return target available while the introduction makes landing inert', async () => {
  const user = userEvent.setup()
  function Replay() {
    const [covered, setCovered] = useState(false)
    return <><div inert={covered}><LandingNavigation onReplay={() => setCovered(true)} /></div><button>Introduction</button></>
  }
  render(<MemoryRouter><Replay /></MemoryRouter>)
  const trigger = screen.getByRole('button', { name: 'More options' })
  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: 'Watch introduction' }))
  await user.click(screen.getByRole('button', { name: 'Introduction' }))
  await user.keyboard('{Escape}')
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
})
