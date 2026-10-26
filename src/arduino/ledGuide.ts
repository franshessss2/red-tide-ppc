import { ZONE_IDS, type DisplayFrame } from './protocol'
import type { Zone } from '../types'
export const ZONE_LED_PINS = [13, 12, 11, 10, 9, 7, 6] as const
export interface LedMeaning { number: number; pin: number; name: string; pattern: string; label: string; detail: string }
const meanings: Record<string, { pattern: string; label: string; detail: string }> = {
  S: { pattern: 'off', label: 'Off · no community warning recorded', detail: 'Interpret only with a working heartbeat and no stale warning. A dark LED alone cannot establish safety.' },
  A: { pattern: 'steady', label: 'On · community warning', detail: 'A community warning is recorded for this zone. Consult the official BFAR bulletin for official advice.' },
  U: { pattern: 'slow', label: 'Slow blink · under review', detail: 'The zone status is under review: 500 ms on, 500 ms off.' },
  X: { pattern: 'fast', label: 'Fast blink · unknown', detail: 'The zone status is unavailable: 125 ms on, 125 ms off. Stale data uses this pattern on all seven zone LEDs.' },
}
export function ledMeanings(frame: DisplayFrame, zones: Zone[]): LedMeaning[] {
  const usable = frame.usable
  return [
    ...ZONE_IDS.map((id, index) => ({ number: index + 1, pin: ZONE_LED_PINS[index], name: zones.find(zone => zone.id === id)?.name ?? id,
      ...(meanings[usable ? frame.states[index] : 'X'] ?? meanings.X) })),
    { number: 8, pin: 5, name: 'Any warning', pattern: usable && frame.any ? 'steady' : 'off', label: usable && frame.any ? 'On · at least one zone has a warning' : 'Off · no current warning signal', detail: 'On if any zone is advisory. This indicator stays dark when the display is stale.' },
    { number: 9, pin: 4, name: 'Heartbeat', pattern: !usable ? 'off' : frame.demo ? 'double' : 'single', label: !usable ? 'Off · display stale' : frame.demo ? 'Double pulse · sample data' : 'Single pulse · shared Firebase data', detail: 'Each second: one 100 ms pulse for shared data; two 100 ms pulses for sample data. This identifies the source, not water safety.' },
    { number: 10, pin: 3, name: 'Stale warning', pattern: usable ? 'off' : 'steady', label: usable ? 'Off · source usable for display' : 'On · source unavailable', detail: 'Steady at boot, with unusable data, or after 15 seconds without a valid frame. Zone LEDs blink fast; heartbeat and any-warning stay off.' },
  ]
}
