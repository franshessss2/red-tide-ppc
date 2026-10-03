import { describe, expect, it } from 'vitest'
import {
  dominantZoneStatus,
  sidePanelReadout,
  zoneSummaryLine,
} from './readouts'

describe('zoneSummaryLine', () => {
  it('matches the briefed peek copy', () => {
    expect(zoneSummaryLine(6, 0)).toBe('6 zones · 0 warnings')
  })

  it('reports advisories in the same line rather than a second one', () => {
    expect(zoneSummaryLine(6, 1)).toBe('6 zones · 1 warning')
    expect(zoneSummaryLine(6, 3)).toBe('6 zones · 3 warnings')
  })

  it('handles the single-zone and empty cases without bad grammar', () => {
    expect(zoneSummaryLine(1, 0)).toBe('1 zone · 0 warnings')
    expect(zoneSummaryLine(0, 0)).toBe('No zone records')
  })

  it('never says both "no advisories" and a count', () => {
    expect(zoneSummaryLine(6, 1)).not.toContain('No advisories')
  })
})

describe('sidePanelReadout', () => {
  it('numbers the two drawer states against the total — the sheet language adapted', () => {
    expect(sidePanelReadout('collapsed')).toBe('01 / 02')
    expect(sidePanelReadout('open')).toBe('02 / 02')
  })
})

describe('dominantZoneStatus', () => {
  it('ranks advisory above unconfirmed above safe', () => {
    expect(dominantZoneStatus({ safe: 6, unconfirmed: 0, advisory: 0 })).toBe('safe')
    expect(dominantZoneStatus({ safe: 5, unconfirmed: 1, advisory: 0 })).toBe('unconfirmed')
    expect(dominantZoneStatus({ safe: 5, unconfirmed: 1, advisory: 1 })).toBe('advisory')
  })

  it('preserves uncertainty when the feed has not arrived', () => {
    expect(dominantZoneStatus({})).toBe('unknown')
  })
})

it('includes unavailable statuses alongside warnings', () => {
  expect(zoneSummaryLine(7, 2, 1)).toBe('7 zones · 2 warnings · 1 unavailable')
  expect(dominantZoneStatus({ safe: 6, unknown: 1 })).toBe('unknown')
})
