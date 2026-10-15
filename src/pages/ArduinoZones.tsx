import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../store'
import { feedLabel } from '../lib/feed'
import { selectDisplay, ZONE_IDS } from '../arduino/protocol'
import { ZoneSerial } from '../arduino/serial'
import type { LinkState, SerialAccess } from '../arduino/serial'

const PINS = [3, 4, 5, 6, 7, 9, 10]
const LABELS: Record<string, string> = { S: 'Off · no community warning recorded', A: 'On · community warning', U: 'Slow blink · under review', X: 'Fast blink · unknown' }

export default function ArduinoZones() {
  const zones = useAppStore(state => state.zones)
  const zonesReady = useAppStore(state => state.zonesReady)
  const zonesFeed = useAppStore(state => state.zonesFeed)
  const backendKind = useAppStore(state => state.backendKind)
  const frame = useMemo(() => selectDisplay({ zones, zonesReady, zonesFeed, backendKind }), [zones, zonesReady, zonesFeed, backendKind])
  const [link, setLink] = useState<LinkState>({ phase: 'disconnected', message: 'Disconnected', acknowledged: null })
  const [connecting, setConnecting] = useState(false)
  const serial = useMemo(() => new ZoneSerial(setLink), [])
  useEffect(() => { serial.setFrame(frame) }, [serial, frame])
  useEffect(() => {
    const hidden = () => { if (document.hidden) serial.pause() }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      // Send best-effort stale and release the owned USB reader on teardown.
      serial.pause()
    }
  }, [serial])
  async function connect() {
    const access = (navigator as Navigator & { serial?: SerialAccess }).serial
    if (!access || !window.isSecureContext) {
      setLink({ phase: 'error', message: 'Use desktop Chrome/Edge on HTTPS or localhost with Web Serial.', acknowledged: null }); return
    }
    if (document.hidden) return
    setConnecting(true)
    try { await serial.connect(access) } finally { setConnecting(false) }
  }
  const active = ['identifying', 'waiting', 'acknowledged'].includes(link.phase)
  const button = 'min-h-11 rounded-lg border border-line px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40'
  return <main className="mx-auto max-w-3xl px-5 py-10 text-paper">
    <nav className="mb-8 flex flex-wrap gap-6 text-sm text-accent" aria-label="Display navigation"><Link to="/map">Public map</Link><a href="/arduino.html">Arduino diagnostics</a></nav>
    <h1 className="font-display text-4xl">{frame.demo ? 'Demo zone-status display' : 'Zone-status display'}</h1>
    <p className="mt-3 font-semibold">Community records, not an official clearance.</p>
    <p className="mt-3 text-sm text-muted">Off alone does not mean safe. Interpret an off zone LED only with a working heartbeat, no stale warning and a checked LED map. Power loss or a failed LED can also look dark.</p>
    <section className="mt-6 rounded-xl border border-line bg-ink-2 p-5" aria-labelledby="source-heading">
      <h2 id="source-heading" className="font-semibold">Source and display connection</h2>
      <p className="mt-2 text-sm">Zones: {feedLabel(zonesFeed)}. {frame.usable ? 'Source usable for this display.' : 'Display stale: source not verified.'}</p>
      <p className="mt-2 text-sm text-muted">{zonesFeed.lastSyncedAt !== null ? `Last server snapshot received: ${new Date(zonesFeed.lastSyncedAt).toLocaleString()}.` : 'No acknowledged server snapshot.'} Receipt time is not a coast-testing date or a continuous server heartbeat.</p>
      <p role="status" className="mt-3 text-sm">{link.message}</p>
      <p className="mt-3 text-sm text-accent">Keep this tab visible and the computer awake. Hiding it pauses the display; reconnect to resume. Without frames, the powered board becomes stale after 15 seconds.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className={button} onClick={() => void connect()} disabled={connecting || active}>Connect zone UNO</button>
        <button className={button} onClick={() => void serial.disconnect()} disabled={!active && !connecting}>Disconnect</button>
        <button className={button} onClick={() => serial.beep()} disabled={link.phase !== 'acknowledged' || !link.acknowledged?.usable || !frame.usable}>Manual beep · 120 ms</button>
      </div>
    </section>
    <section className="mt-8" aria-labelledby="led-heading">
      <h2 id="led-heading" className="text-xl font-semibold">Requested LED states</h2>
      <p className="mt-2 text-sm text-muted">These are requested outputs, not measured light or wiring feedback. Check the standalone pin sweep before use.</p>
      <ol className="mt-4 divide-y divide-line rounded-xl border border-line px-4">
        {ZONE_IDS.map((id, index) => <li key={id} className="py-3 text-sm"><strong>LED {index + 1} · D{PINS[index]} · {zones.find(zone => zone.id === id)?.name ?? id}</strong><span className="block text-muted">{LABELS[frame.states[index]]}</span></li>)}
      </ol>
      <p className="mt-4 text-sm">LED 8 / D11: any advisory, dark when stale. LED 9 / D12: {frame.demo ? 'double pulse for demo data' : 'single pulse for synced Firebase data'}. LED 10 / D13: steady on when stale; onboard L mirrors D13. Stale means seven fast-blinking unknowns, any-advisory dark and heartbeat off.</p>
    </section>
    <section className="mt-8 border-t border-line pt-5 text-sm text-muted" aria-labelledby="setup-heading">
      <h2 id="setup-heading" className="font-semibold text-paper">Before connecting</h2>
      <p className="mt-2">Use red_tide_zones, not the combined sketch. Disconnect the servo and HC-SR04; their wiring conflicts with these LEDs. Buzzer signal is D8 with an active-LOW 5V module and 10 kΩ signal pull-up. Physical wiring and issue #80 remain unverified.</p>
      <p className="mt-2">This route reads the existing app store. Serial input only updates connection diagnostics; it cannot change zones or reports. Sample records remain local to this app/browser.</p>
      <a className="mt-3 inline-block text-accent underline" href="https://github.com/franshessss2/red-tide-ppc/blob/main/docs/arduino-zones.md" target="_blank" rel="noreferrer">Firmware, protocol and bench checklist</a>
    </section>
  </main>
}
