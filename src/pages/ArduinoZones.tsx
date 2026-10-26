import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../store'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { ArduinoLedGuide } from '../components/ArduinoLedGuide'
import { feedLabel } from '../lib/feed'
import { selectDisplay } from '../arduino/protocol'
import { ZoneSerial } from '../arduino/serial'
import type { LinkState, SerialAccess } from '../arduino/serial'


export default function ArduinoZones() {
  const zones = useAppStore(state => state.zones)
  const zonesReady = useAppStore(state => state.zonesReady)
  const zonesFeed = useAppStore(state => state.zonesFeed)
  const backendKind = useAppStore(state => state.backendKind)
  const online = useOnlineStatus()
  const frame = useMemo(() => selectDisplay({ zones, zonesReady, zonesFeed: !online && backendKind === 'firebase' ? { ...zonesFeed, phase: 'cached' } : zonesFeed, backendKind }), [zones, zonesReady, zonesFeed, backendKind, online])
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
    <nav className="mb-8 flex flex-wrap gap-6 text-sm text-accent" aria-label="Display navigation"><Link to="/map">Public map</Link><a href="/arduino.html">Arduino setup</a></nav>
    <h1 className="font-display text-4xl">{backendKind === 'demo' ? 'Demo zone-status display' : 'Zone-status display'}</h1>
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
      </div>
    </section>
    <ArduinoLedGuide frame={frame} zones={zones} link={link} />
    <section className="mt-8 border-t border-line pt-5 text-sm text-muted" aria-labelledby="setup-heading">
      <h2 id="setup-heading" className="font-semibold text-paper">Before connecting</h2>
      <p className="mt-2">Use the ten-LED red_tide_zones sketch from this version. The combined sketch and older zone builds use different wiring. No buzzer, servo or HC-SR04 is connected; D8 is unused. The owner reported all ten LEDs working in the bench sweep. Zone patterns, current and fault behavior still need physical acceptance; issue #80 is separate.</p>
      <p className="mt-2">This route reads the existing app store. Serial input only updates connection diagnostics; it cannot change zones or reports. Sample records remain local to this app/browser.</p>
      <a className="mt-3 inline-block text-accent underline" href="https://github.com/franshessss2/red-tide-ppc/blob/main/docs/arduino-zones.md" target="_blank" rel="noreferrer">Firmware, protocol and bench checklist</a>
    </section>
  </main>
}
