// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SEED_ZONES } from '../data/zones'
import { zoneLoadDelayMs } from '../motion/mapMotion'
import type { Zone, ZoneStatus } from '../types'
import { Map } from './Map'

/**
 * Phase-1 motion wiring on the zone polygons.
 *
 * The modifier classes (`--loading`, `--advisory`, `--dimmed`) are applied
 * imperatively from layer refs — the same StrictMode-safe pattern
 * `Map.test.tsx` pins for `--selected` — so these tests assert what actually
 * lands on the path nodes, not what the JSX asked for.
 */

function makeZones(statusOverrides: Record<string, ZoneStatus> = {}): Zone[] {
  return SEED_ZONES.map((zone) => ({
    ...zone,
    polygon: [...zone.polygon],
    status: statusOverrides[zone.id] ?? zone.status,
    lastUpdated: Date.now(),
  }))
}

const NOOP = () => {}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function renderMap({
  zones = makeZones(),
  selectedZoneId = null,
}: {
  zones?: Zone[]
  selectedZoneId?: string | null
} = {}) {
  return render(
    <Map
      zones={zones}
      reports={[]} pendingCounts={{}}
      selectedZoneId={selectedZoneId}
      resetToken={0}
      focusZoneId={null}
      focusToken={0}
      onSelectZone={NOOP}
      onReport={NOOP}
    />,
  )
}

function zonePaths(container: HTMLElement): SVGPathElement[] {
  return Array.from(
    container.querySelectorAll<SVGPathElement>('.leaflet-overlay-pane path'),
  )
}

describe('zone load-in wiring', () => {
  it('marks every polygon with the loading class and a staggered delay', async () => {
    const zones = makeZones()
    const { container } = renderMap({ zones })

    await waitFor(() => {
      expect(zonePaths(container)).toHaveLength(zones.length)
      for (const path of zonePaths(container)) {
        expect(path.classList.contains('zone-path--loading')).toBe(true)
      }
    })

    // Delays rise in exact stagger steps, in DOM order.
    const delays = zonePaths(container).map((path) =>
      Number(path.style.getPropertyValue('--zone-delay').replace('ms', '')),
    )
    delays.forEach((delay, index) => {
      expect(delay).toBe(zoneLoadDelayMs(index))
    })
  })
})

describe('advisory modifier', () => {
  it('flags advisory polygons and nobody else', async () => {
    const zones = makeZones()
    const advisoryZone = zones[2]
    advisoryZone.status = 'advisory'
    const { container } = renderMap({ zones })

    await waitFor(() => {
      expect(
        zonePaths(container)[2].classList.contains('zone-path--advisory'),
      ).toBe(true)
    })
    for (const [index, path] of zonePaths(container).entries()) {
      if (index !== 2) {
        expect(path.classList.contains('zone-path--advisory')).toBe(false)
      }
    }
  })

  it('moves the advisory class when the zone status changes', async () => {
    const zones = makeZones()
    zones[0].status = 'advisory'
    const { container, rerender } = renderMap({ zones })

    await waitFor(() => {
      expect(zonePaths(container)[0].classList.contains('zone-path--advisory')).toBe(true)
    })

    // The status flips back — the class must follow (this is also what the
    // 400ms fill/stroke crossfade in CSS keys off).
    const flipped = zones.map((zone, index) =>
      index === 0 ? { ...zone, status: 'safe' as const } : zone,
    )
    rerender(
      <Map
        zones={flipped}
        reports={[]} pendingCounts={{}}
        selectedZoneId={null}
        resetToken={0}
        focusZoneId={null}
        focusToken={0}
        onSelectZone={NOOP}
        onReport={NOOP}
      />,
    )

    await waitFor(() => {
      expect(zonePaths(container)[0].classList.contains('zone-path--advisory')).toBe(false)
    })
  })
})

describe('under-review boundary motion', () => {
  it('marks every yellow zone, including a selected zone, and follows status changes', async () => {
    const zones = makeZones(Object.fromEntries(SEED_ZONES.map(zone => [zone.id, 'unconfirmed'])))
    const { container, rerender } = renderMap({ zones, selectedZoneId: zones[0].id })
    await waitFor(() => {
      expect(zonePaths(container)).toHaveLength(7)
      for (const path of zonePaths(container)) {
        expect(path.getAttribute('data-zone-status')).toBe('unconfirmed')
        expect(path.getAttribute('stroke-dasharray')).toBe('6 5')
        expect(path.classList.contains('zone-path--advisory')).toBe(false)
      }
    })
    expect(zonePaths(container)[0].getAttribute('fill-opacity')).toBe('0.6')
    const updated = zones.map((zone, index) => ({ ...zone, status: (index === 0 ? 'advisory' : 'safe') as ZoneStatus }))
    rerender(<Map zones={updated} reports={[]} pendingCounts={{}} selectedZoneId={null}
      resetToken={0} focusZoneId={null} focusToken={0} onSelectZone={NOOP} onReport={NOOP} />)
    await waitFor(() => {
      expect(container.querySelectorAll('.zone-path[data-zone-status="unconfirmed"]')).toHaveLength(0)
      expect(zonePaths(container)[0].classList.contains('zone-path--advisory')).toBe(true)
    })
  })

  it('honors Save-Data changes and pauses the map loops when the tab is hidden', async () => {
    const network = Object.assign(new EventTarget(), { saveData: true })
    vi.stubGlobal('navigator', { connection: network })
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    const { container, unmount } = renderMap()
    const map = container.querySelector<HTMLElement>('.leaflet-container')!
    expect(map.dataset.reviewMotion).toBe('static')
    act(() => { network.saveData = false; network.dispatchEvent(new Event('change')) })
    expect(map.dataset.reviewMotion).toBe('enabled')
    hidden.mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange'))
    expect(map.classList.contains('map-motion-paused')).toBe(true)
    hidden.mockReturnValue(false)
    fireEvent(document, new Event('visibilitychange'))
    expect(map.classList.contains('map-motion-paused')).toBe(false)
    unmount()
    expect(map.dataset.reviewMotion).toBeUndefined()
    expect(document.body.classList.contains('map-motion-paused')).toBe(false)
  })
})

describe('selection dimming', () => {
  it('dims every non-selected polygon while a selection exists', async () => {
    const zones = makeZones()
    const selectedId = zones[1].id
    const { container } = renderMap({ zones, selectedZoneId: selectedId })

    await waitFor(() => {
      const paths = zonePaths(container)
      expect(paths).toHaveLength(zones.length)
      expect(paths[1].classList.contains('zone-path--selected')).toBe(true)
      expect(paths[1].classList.contains('zone-path--dimmed')).toBe(false)
      for (const [index, path] of paths.entries()) {
        if (index === 1) continue
        expect(path.classList.contains('zone-path--dimmed')).toBe(true)
      }
    })
  })

  it('reverses the dim on deselect', async () => {
    const zones = makeZones()
    const { container, rerender } = renderMap({
      zones,
      selectedZoneId: zones[0].id,
    })

    await waitFor(() => {
      expect(zonePaths(container)[1].classList.contains('zone-path--dimmed')).toBe(true)
    })

    rerender(
      <Map
        zones={zones}
        reports={[]} pendingCounts={{}}
        selectedZoneId={null}
        resetToken={0}
        focusZoneId={null}
        focusToken={0}
        onSelectZone={NOOP}
        onReport={NOOP}
      />,
    )

    await waitFor(() => {
      for (const path of zonePaths(container)) {
        expect(path.classList.contains('zone-path--dimmed')).toBe(false)
      }
    })
  })
})
