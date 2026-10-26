import { useState } from 'react'
import type { Zone } from '../types'
import type { DisplayFrame } from '../arduino/protocol'
import { encodeFrame } from '../arduino/protocol'
import type { LinkState } from '../arduino/serial'
import { ledMeanings } from '../arduino/ledGuide'
import '../styles/community-tracking.css'

/** Display-only guide: selecting a light never sends a serial command. */
export function ArduinoLedGuide({ frame, zones, link }: { frame: DisplayFrame; zones: Zone[]; link: LinkState }) {
  const [selected, setSelected] = useState(1)
  const meanings = ledMeanings(frame, zones)
  const current = meanings[selected - 1]
  const acknowledged = link.phase === 'acknowledged' && link.acknowledged !== null && encodeFrame(link.acknowledged) === encodeFrame(frame)
  return <section className="led-guide" aria-labelledby="led-heading">
    <header><div><p className="report-sync-eyebrow">Ten red lights · one shared coast</p><h2 id="led-heading">Requested LED states</h2></div><span className="led-guide__mode">{acknowledged ? 'USB ACKNOWLEDGED' : 'PREVIEW ONLY'}</span></header>
    <p className="led-guide__intro">Choose a light to read its role. These are requested outputs, not measured light or wiring feedback. Check the standalone pin sweep before use.</p>
    <div className="led-guide__board"><span>ARDUINO UNO</span><strong>13 → 9 · skip 8 · 7 → 3</strong><small>Signal pin → 220 Ω resistor → red LED · common GND rail</small></div>
    <ol className="led-guide__grid" aria-label="Ten-LED wiring map">{meanings.map(led => <li key={led.number}><button type="button" aria-pressed={selected === led.number} onClick={() => setSelected(led.number)} aria-label={`LED ${led.number} · D${led.pin} · ${led.name}`}>
      <span className="led-guide__bulb" data-pattern={led.pattern} aria-hidden="true" /><span className="led-guide__pin">LED {led.number} · D{led.pin}</span><strong>{led.name}</strong><small>{led.number <= 7 ? 'COASTAL ZONE' : 'SYSTEM'}</small>
    </button></li>)}</ol>
    <article className="led-guide__explanation" aria-label="Selected LED explanation"><div><span className="led-guide__bulb" data-pattern={current.pattern} aria-hidden="true" /><h3>LED {current.number} · D{current.pin} · {current.name}</h3></div><strong>{current.label}</strong><p>{current.detail}</p></article>
    <details className="led-guide__legend"><summary>Read every light pattern</summary><dl>{[
      ['Zone · steady on', 'Community warning recorded.'], ['Zone · slow blink', 'Under review · 500 ms on / 500 ms off.'], ['Zone · fast blink', 'Unknown · 125 ms on / 125 ms off.'], ['Zone · off', 'No alert recorded, only when heartbeat works and stale is off.'],
      ['D5 · any warning', 'On when at least one zone has a warning; off when stale.'], ['D4 · heartbeat', 'Single pulse for shared data; double pulse for sample data.'], ['D3 · stale', 'Steady on when the source is unusable, at boot or after 15 seconds without frames.'],
    ].map(([label, detail]) => <div key={label}><dt>{label}</dt><dd>{detail}</dd></div>)}</dl></details>
    <p className="led-guide__foot">D8 is unused. The onboard L light follows D13. A USB acknowledgement confirms a frame, not the physical LEDs. The diagram uses static pattern indicators.</p>
  </section>
}
