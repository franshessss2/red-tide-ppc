import { expect, it } from 'vitest'
import { ledMeanings } from './ledGuide'
import { STALE_FRAME } from './protocol'
it('maps ten light roles to the tested UNO wiring, including the skipped pin', () => {
  const leds = ledMeanings({ states: 'AUSXXXX', any: true, usable: true, demo: false }, [])
  expect(leds.map(led => led.pin)).toEqual([13, 12, 11, 10, 9, 7, 6, 5, 4, 3])
  expect(leds.map(led => led.pattern)).toEqual(['steady', 'slow', 'off', 'fast', 'fast', 'fast', 'fast', 'steady', 'single', 'off'])
})
it('matches the firmware stale pattern and keeps sample heartbeat distinct', () => {
  const stale = ledMeanings(STALE_FRAME, [])
  expect(stale.slice(0, 7).every(led => led.pattern === 'fast')).toBe(true)
  expect(stale.slice(7).map(led => led.pattern)).toEqual(['off', 'off', 'steady'])
  expect(ledMeanings({ states: 'SSSSSSS', any: false, usable: true, demo: true }, [])[8].pattern).toBe('double')
})
