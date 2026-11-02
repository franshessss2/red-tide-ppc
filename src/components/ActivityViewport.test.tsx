// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ActivityViewport } from './ActivityViewport'
const preference = vi.hoisted(() => ({ reduced: false }))
vi.mock('../motion/preferences', () => ({ useReducedMotion: () => preference.reduced }))
const disconnect = vi.fn()
beforeEach(() => {
  preference.reduced = false; disconnect.mockClear()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('makes the departing scene inert, coalesces rapid switches and releases its observer', async () => {
  const entered = vi.fn()
  const scene = (key: string) => <ActivityViewport sceneKey={key} direction={1} onEntered={entered}><button>{key}</button></ActivityViewport>
  const view = render(scene('History'))
  view.rerender(scene('Changes'))
  expect(screen.getByText('History').closest('[inert]')).toBeTruthy()
  view.rerender(scene('My reports'))
  await screen.findByRole('button', { name: 'My reports' })
  await waitFor(() => expect(entered).toHaveBeenCalled())
  expect(screen.queryByRole('button', { name: 'History' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Changes' })).toBeNull()
  expect(screen.getAllByRole('button')).toHaveLength(1)
  view.unmount(); expect(disconnect).toHaveBeenCalledOnce()
})
it('switches immediately when reduced motion becomes active during an exit', () => {
  const entered = vi.fn()
  const view = render(<ActivityViewport sceneKey="old" direction={1} onEntered={entered}><button>Old</button></ActivityViewport>)
  view.rerender(<ActivityViewport sceneKey="middle" direction={1} onEntered={entered}><button>Middle</button></ActivityViewport>)
  preference.reduced = true
  view.rerender(<ActivityViewport sceneKey="latest" direction={1} onEntered={entered}><button>Latest</button></ActivityViewport>)
  expect(screen.getByRole('button', { name: 'Latest' })).toBeTruthy()
  expect(screen.queryByText('Old')).toBeNull()
  expect(screen.queryByText('Middle')).toBeNull()
  expect(disconnect).toHaveBeenCalledOnce()
})
