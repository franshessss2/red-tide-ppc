import { TextReveal } from '../components/TextReveal'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { DEVICE_ID, DEVICE_ZONE, HISTORY_LIMIT, connectionLabel, parseReading } from '../devices/model'
import type { DeviceFeed, DeviceReading } from '../devices/model'
import '../styles/devices.css'

const time = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function Devices() {
  const [rehearsal, setRehearsal] = useState(false)
  const [feed, setFeed] = useState<DeviceFeed>({ configured: false, readings: [] })
  const [local, setLocal] = useState<DeviceReading[]>([])
  const [temperature, setTemperature] = useState(28)
  const [cloudiness, setCloudiness] = useState(15)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now)
  const [refresh, setRefresh] = useState(0)
  const session = useRef(`rehearsal-${Date.now().toString(36)}`)
  const sequence = useRef(0)

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(clock)
  }, [])

  useEffect(() => {
    if (rehearsal) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let active: AbortController | undefined
    async function poll() {
      clearTimeout(timer)
      if (stopped || document.hidden) return
      active?.abort()
      const controller = new AbortController()
      active = controller
      const timeout = setTimeout(() => controller.abort(), 8000)
      setLoading(true)
      try {
        const response = await fetch('/api/device-readings', { signal: controller.signal, cache: 'no-store' })
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('unavailable')
        const data = await response.json() as DeviceFeed
        if (typeof data.configured !== 'boolean' || !Array.isArray(data.readings) || data.readings.length > HISTORY_LIMIT) throw new Error('invalid')
        const readings = data.readings.map(parseReading)
        if (readings.some(reading => !reading || reading.source !== 'wokwi')) throw new Error('invalid')
        if (!stopped && !controller.signal.aborted) {
          setFeed({ configured: data.configured, readings: readings as DeviceReading[] })
          setError('')
        }
      } catch {
        if (!stopped && active === controller && !document.hidden) setError('Device connection unavailable. Saved readings may be stale. Local rehearsal is still available.')
      } finally {
        clearTimeout(timeout)
        if (!stopped && active === controller) {
          setLoading(false)
          timer = setTimeout(poll, 60_000)
        }
      }
    }
    function visibility() {
      clearTimeout(timer)
      if (document.hidden) active?.abort()
      else void poll()
    }
    void poll()
    document.addEventListener('visibilitychange', visibility)
    return () => { stopped = true; clearTimeout(timer); active?.abort(); document.removeEventListener('visibilitychange', visibility) }
  }, [rehearsal, refresh])

  function sendLocalReading() {
    const receivedAt = Date.now()
    setNow(receivedAt)
    const reading: DeviceReading = { deviceId: DEVICE_ID, zoneId: DEVICE_ZONE,
      sessionId: session.current, sequence: sequence.current++, temperatureC: temperature,
      cloudinessPercent: cloudiness, receivedAt, source: 'local-rehearsal' }
    setLocal(previous => [reading, ...previous].slice(0, HISTORY_LIMIT))
  }

  const readings = rehearsal ? local : feed.readings
  const latest = readings[0]
  const status = !rehearsal && error ? 'Connection unavailable' : !rehearsal && !feed.configured
    ? loading ? 'Checking connection' : 'Connection not configured' : connectionLabel(latest, now)

  return <div className="device-page">
    <Header eyebrow="School prototype" title="Red Tide" right={<Link className="device-home" to="/">Home</Link>} />
    <main className="device-main">
      <p className="device-eyebrow">ENVIRONMENTAL MONITORING · SIMULATION</p>
      <h1><TextReveal text="Coastal device" /></h1>
      <p className="device-intro">A virtual station for demonstrating how sensor readings reach Red Tide. These readings do not detect toxic algae or establish shellfish safety.</p>
      <div className="device-modes" role="group" aria-label="Reading source">
        <button aria-pressed={!rehearsal} onClick={() => setRehearsal(false)}>Wokwi connection</button>
        <button aria-pressed={rehearsal} onClick={() => setRehearsal(true)}>Local rehearsal</button>
      </div>
      <section className="device-station" aria-label="Virtual station">
        <div className="device-station-heading"><div><h2>{DEVICE_ID}</h2><p>Assigned zone: Honda Bay Inner · fixed demo assignment</p></div><span className="device-source">{rehearsal ? 'Local rehearsal · browser only' : 'Simulated device readings · Wokwi'}</span></div>
        <p role="status" className="device-status">{status}</p>
        {!rehearsal && error && <p role="alert" className="device-notice">{error}</p>}
        {!rehearsal && !feed.configured && !loading && !error && <p className="device-notice">The Wokwi connection needs its server configuration. Local rehearsal works without an account or hardware.</p>}
        <div className="device-readouts">
          <div><h3>Water temperature</h3><p>{latest ? `${latest.temperatureC.toFixed(1)} °C` : '—'}</p><span>Virtual temperature probe</span></div>
          <div><h3>Simulated cloudiness</h3><p>{latest ? `${latest.cloudinessPercent.toFixed(0)} %` : '—'}</p><span>Knob input · not NTU</span></div>
        </div>
        <p className="device-received">{latest ? `Last received: ${time(latest.receivedAt)} · ${new Date(latest.receivedAt).toLocaleDateString()}` : 'No reading received yet.'}</p>
        {!rehearsal && <button className="device-secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{loading ? 'Checking…' : 'Refresh readings'}</button>}
      </section>
      {rehearsal && <section className="device-rehearsal" aria-label="Rehearsal controls">
        <h2><TextReveal text="Rehearse without hardware" /></h2><p>Adjust the inputs, then send a local reading. This does not contact Wokwi, Firebase or the device endpoint. Readings clear when you leave this page.</p>
        <label htmlFor="device-temperature">Temperature: {temperature.toFixed(1)} °C</label>
        <input id="device-temperature" type="range" min="0" max="50" step="0.5" value={temperature} onChange={event => setTemperature(Number(event.target.value))} />
        <label htmlFor="device-cloudiness">Simulated cloudiness: {cloudiness} %</label>
        <input id="device-cloudiness" type="range" min="0" max="100" value={cloudiness} onChange={event => setCloudiness(Number(event.target.value))} />
        <button className="device-primary" onClick={sendLocalReading}>Send local reading</button>
      </section>}
      <section className="device-history" aria-label="Recent readings"><h2><TextReveal text="Recent readings" /></h2><p>Latest 60 samples. Connection status uses the time Red Tide received a reading, not a laboratory test date.</p>
        {readings.length ? <div className="device-table-scroll"><table><caption className="sr-only">{rehearsal ? 'Local rehearsal' : 'Wokwi'} reading history</caption><thead><tr><th scope="col">Received</th><th scope="col">Temperature</th><th scope="col">Cloudiness</th></tr></thead><tbody>{readings.map(reading => <tr key={`${reading.sessionId}-${reading.sequence}`}><td>{time(reading.receivedAt)}</td><td>{reading.temperatureC.toFixed(1)} °C</td><td>{reading.cloudinessPercent.toFixed(0)} %</td></tr>)}</tbody></table></div> : <p className="device-empty">Readings will appear here after the first sample arrives.</p>}
      </section>
      <footer className="device-footer"><a href="https://wokwi.com/projects/new/esp32" target="_blank" rel="noreferrer">Open Wokwi ESP32 simulator ↗</a><p>Community warnings remain a separate human review process. Simulated readings never change a zone’s status.</p></footer>
    </main>
  </div>
}
