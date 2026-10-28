import { TextReveal } from '../TextReveal'
import { INTRO_COAST_PATH } from '../../data/introCoast'
import { REEL_SCENES, REEL_CLOSING_SCENE } from './reelScenes'
import { ObservationCard, PanelHeader, SharedDevices, type ObservationStep } from './IntroFeaturePreviews'
import { IntroAcknowledgements } from './IntroAcknowledgements'
const ZONES = [{ x: 130, y: 65 }, { x: 205, y: 145 }, { x: 265, y: 204 }, { x: 344, y: 230 }, { x: 215, y: 278 }, { x: 320, y: 348 }, { x: 365, y: 386 }]
export function TideMark({ animated = false }: { animated?: boolean }) {
  return <span className={`reel-mark${animated ? ' reel-mark--join' : ''}`} aria-hidden="true">
    <span className="reel-mark__teal" />
    <span className="reel-mark__amber" />
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M14 29c6-8 12 8 18 0s12 8 18 0M14 39c6-8 12 8 18 0s12 8 18 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="17" r="4" fill="currentColor" />
    </svg>
  </span>
}
function CoastPreview() {
  return <div className="coast-map coast-panel reel-map" aria-hidden="true">
    <PanelHeader label="PUERTO PRINCESA / PALAWAN" />
    <div className="coast-map__canvas">
      <div className="coast-map__grid" />
      <svg viewBox="0 0 490 435" fill="none">
        <path className="coast-map__land" d={`${INTRO_COAST_PATH} L-60 125 L-60 470 L345 470 L305.5 376.8`} transform="translate(55 5)" />
        <path className="coast-map__contour" d={INTRO_COAST_PATH} pathLength="1" transform="translate(55 5)" />
        <g className="coast-map__currents">
          <path d="M310 50Q420 130 395 210" />
          <path d="M335 55Q445 135 420 215" />
          <path d="M360 60Q470 140 445 220" />
        </g>
        <path className="coast-map__route" d="M130 65Q245 80 205 145T265 204T344 230T215 278T320 348T365 386" />{ZONES.map((p, index) => <g key={index} className="coast-map__pin" style={{ animationDelay: `${index * 120}ms` }}>
          <circle cx={p.x} cy={p.y} r="17" className="coast-map__halo" />
          <circle cx={p.x} cy={p.y} r="5" />
          <text x={p.x + 23} y={p.y + 4}>{String(index + 1).padStart(2, '0')}</text>
        </g>)}</svg>
      <div className="coast-map__caption">
        <strong>07</strong>
        <span>coastal areas<small>A shared view of our shores.</small>
        </span>
      </div>
      <span className="coast-map__compass">N ↑</span>
    </div>
    <div className="coast-panel-foot">Schematic coastline · © OpenStreetMap contributors</div>
  </div>
}
function ClosingPreview() {
  return <div className="coast-closing" aria-hidden="true">
    <div className="coast-closing__identity">
      <div className="coast-closing__rings">
        <i /><i /><i />
      </div>
      <div className="coast-closing__float"><TideMark animated /></div>
    </div>
    <span className="coast-closing__coordinate">PUERTO PRINCESA · PALAWAN</span>
    <SharedDevices />
    <span className="coast-closing__line">THE COAST CONNECTS US.</span>
  </div>
}
export function ReportPreview({ step = 'report' }: { step?: ObservationStep }) { return <ObservationCard step={step} /> }
function SceneVisual({ visual }: { visual: (typeof REEL_SCENES)[number]['visual'] }) {
  if (visual === 'coast') return <CoastPreview />
  if (visual === 'closing') return <ClosingPreview />
  return <ReportPreview step={visual} />
}
export function ReelCopy({ scene, reduced = false }: { scene: number; reduced?: boolean }) {
  const copy = REEL_SCENES[reduced ? REEL_CLOSING_SCENE : scene]
  return <>
    <p className="showroom-eyebrow">{copy.tag}</p>
    <h1>
      <TextReveal text={copy.title} effect="words" trigger="mount" className="reel-text-reveal" />
    </h1>
    <p className="showroom-description">{copy.description}</p>
    <p className="reel-scene__detail">{copy.detail}</p>{reduced && <p className="showroom-disclaimer">Reports are reviewed by an admin. Connected website, Android and Windows apps share community records. Check official BFAR bulletins.</p>}</>
}
export const isWorkflowScene = (scene: number) => scene >= 1 && scene <= 3
/** Keep the observation DOM mounted through report, review and shared delivery. */
export function WorkflowStage({ scenes, current }: { scenes: number[]; current: number }) {
  const target = scenes[scenes.length - 1]
  const step = target === 1 ? 'report' : target === 2 ? 'review' : 'shared'
  return <div className="reel-scene reel-scene--feature reel-workflow-scene coast-scene">
    <div className="reel-scene__visual">
      <ReportPreview step={step} />
    </div>
    <div className="reel-scene__copy reel-workflow-copy">{scenes.map(scene => <div key={scene} aria-hidden={scene !== current ? true : undefined} className={`reel-workflow-copy__chapter${scenes.length > 1 ? scene === current ? ' showroom-stage--out' : ' showroom-stage--incoming' : ''}`}>
      <ReelCopy scene={scene} />
    </div>)}</div>
  </div>
}
export function ReelStage({ scene, reduced }: { scene: number; reduced: boolean }) {
  const current = reduced ? REEL_CLOSING_SCENE : scene
  return <div className={`reel-scene coast-scene${current === REEL_CLOSING_SCENE ? ' coast-scene--closing' : ''}${reduced ? ' reel-scene--static' : ''}`}>
    <div className="reel-scene__visual">
      <SceneVisual visual={REEL_SCENES[current].visual} />
    </div>
    <div className="reel-scene__copy">
      <ReelCopy scene={current} reduced={reduced} />
      {current === REEL_CLOSING_SCENE && <IntroAcknowledgements />}
    </div>
  </div>
}
