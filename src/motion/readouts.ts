/**
 * Exact community record counts for the zone drawer.
 *
 * Everything here is pure and string/number-only so the exact wording and the
 * pluralisation rules are unit-tested rather than buried in JSX. The copy is
 * *derived from counts*, never hand-written per state, which is the difference
 * between a dossier-style readout and a marketing line.
 *
 */

import type { ZoneStatus } from '../types'
import type { SidePanelState } from './sidePanelAnchors'

/**
 * The one line the sheet shows at peek: `"6 zones · 0 warnings"`.
 *
 * Kept short on purpose — it has to survive a 375px-wide phone next to the
 * anchor readout without wrapping, because a wrapping peek line defeats the
 * point of the anchor.
 */
export function zoneSummaryLine(zoneCount: number, advisoryCount: number, unknownCount = 0): string {
  if (zoneCount === 0) return 'No zone records'
  const zones = `${zoneCount} ${zoneCount === 1 ? 'zone' : 'zones'}`
  const warnings = `${advisoryCount} ${advisoryCount === 1 ? 'warning' : 'warnings'}`
  return `${zones} · ${warnings}${unknownCount > 0 ? ` · ${unknownCount} unavailable` : ''}`
}

/**
 * `01 / 02` style position readout for a two-state side drawer — the same
 * instrument language as the sheet's `01 / 03` strip, adapted to the two
 * detents a drawer has. `collapsed` is the first position, `open` the
 * second, mirroring how `peek` was the sheet's first.
 */
export function sidePanelReadout(state: SidePanelState): string {
  return state === 'collapsed' ? '01 / 02' : '02 / 02'
}

/**
 * Most severe status currently present, for the closed drawer's single pip.
 *
 * Warnings rank above records under review; unavailable status ranks above
 * known no-alert records. An empty feed remains unknown. Resolved here rather than inline so the sheet can never
 * disagree with the map about what matters most.
 */
export function dominantZoneStatus(counts: Partial<Record<ZoneStatus, number>>): ZoneStatus {
  if ((counts.advisory ?? 0) > 0) return 'advisory'
  if ((counts.unconfirmed ?? 0) > 0) return 'unconfirmed'
  if ((counts.unknown ?? 0) > 0) return 'unknown'
  return (counts.safe ?? 0) > 0 ? 'safe' : 'unknown'
}
