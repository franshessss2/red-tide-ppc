// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HeroBackdrop } from './HeroBackdrop'

vi.mock('../motion/LandingMotionPolicy', () => ({ useDecorativeMotionDisabled: () => false }))

const renderer = vi.hoisted(() => ({ loads: 0, mounts: 0, cleanups: 0 }))
vi.mock('./ferrofluid/Ferrofluid', async () => {
  renderer.loads += 1
  const { useEffect } = await import('react')
  return { default: ({ paused }: { paused: boolean }) => {
    useEffect(() => {
      renderer.mounts += 1
      return () => { renderer.cleanups += 1 }
    }, [])
    return <div data-testid="visibility-canvas" data-paused={String(paused)} />
  } }
})

let observe: (entries: Array<{ isIntersecting: boolean }>) => void
let idle: Map<number, () => void>
let handle: number

beforeEach(() => {
  renderer.mounts = renderer.cleanups = 0
  idle = new Map()
  handle = 0
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
    idle.set(++handle, callback)
    return handle
  })
  vi.stubGlobal('cancelIdleCallback', (id: number) => { idle.delete(id) })
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof observe) { observe = callback }
    observe() {}
    disconnect() {}
  })
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(document, 'hidden')
  vi.unstubAllGlobals()
})

function intersect(visible: boolean) {
  act(() => observe([{ isIntersecting: visible }]))
}

function hide(hidden: boolean) {
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

async function flushIdle() {
  await act(async () => {
    const callbacks = [...idle.values()]
    idle.clear()
    callbacks.forEach(callback => callback())
  })
}

describe('HeroBackdrop first-load eligibility', () => {
  it('does not load after the hero leaves the viewport before idle', async () => {
    render(<HeroBackdrop />)
    intersect(true)
    intersect(false)
    await flushIdle()

    expect(screen.queryByTestId('visibility-canvas')).toBeNull()
    expect(renderer.loads).toBe(0)
    expect(renderer.mounts).toBe(0)
    expect(screen.getByTestId('hero-static-backdrop')).toBeTruthy()

    intersect(true)
    expect(await screen.findByTestId('visibility-canvas')).toBeTruthy()
    expect(renderer.loads).toBe(1)
    expect(renderer.mounts).toBe(1)
  })

  it('does not first mount in a hidden tab even after idle', async () => {
    render(<HeroBackdrop />)
    await flushIdle()
    hide(true)
    intersect(true)
    await act(async () => {})

    expect(screen.queryByTestId('visibility-canvas')).toBeNull()
    expect(renderer.mounts).toBe(0)

    hide(false)
    expect(await screen.findByTestId('visibility-canvas')).toBeTruthy()
  })

  it('keeps the same mounted renderer when paused, then resumes and cleans up on unmount', async () => {
    const view = render(<HeroBackdrop />)
    intersect(true)
    await flushIdle()
    const canvas = await screen.findByTestId('visibility-canvas')
    expect(canvas.getAttribute('data-paused')).toBe('false')

    intersect(false)
    expect(screen.getByTestId('visibility-canvas')).toBe(canvas)
    expect(canvas.getAttribute('data-paused')).toBe('true')
    hide(true)
    intersect(true)
    expect(canvas.getAttribute('data-paused')).toBe('true')
    hide(false)
    expect(canvas.getAttribute('data-paused')).toBe('false')
    expect(renderer.mounts).toBe(1)
    expect(renderer.cleanups).toBe(0)

    view.unmount()
    expect(renderer.cleanups).toBe(1)
  })

  it('cancels pending idle work on unmount', () => {
    const view = render(<HeroBackdrop />)
    expect(idle.size).toBe(1)
    view.unmount()
    expect(idle.size).toBe(0)
    expect(renderer.mounts).toBe(0)
  })
})
