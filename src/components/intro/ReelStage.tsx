import { TextReveal } from "../TextReveal";
import type { CSSProperties } from "react";
import { INTRO_COAST_PATH } from "../../data/introCoast";
import { REEL_SCENES, REEL_CLOSING_SCENE } from "./reelScenes";
import { ReviewPreview, WarningPreview, SourcePreview, HardwarePreview } from "./IntroFeaturePreviews";

const OBSERVATION = "Unusual water colour";
const ZONES = [
  { x: 249, y: 47 },
  { x: 294, y: 128 },
  { x: 327, y: 193 },
  { x: 339, y: 246 },
  { x: 334, y: 270 },
  { x: 391, y: 347 },
  { x: 495, y: 377 },
];

/** Original vector graphics; illustrative UI never reads or modifies map data. */
export function TideMark({ animated = false }: { animated?: boolean }) {
  return (
    <span
      className={`reel-mark${animated ? " reel-mark--join" : ""}`}
      aria-hidden="true"
    >
      <span className="reel-mark__teal" />
      <span className="reel-mark__amber" />
      <svg viewBox="0 0 64 64" fill="none">
        <path
          d="M14 29c6-8 12 8 18 0s12 8 18 0M14 39c6-8 12 8 18 0s12 8 18 0"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="32" cy="17" r="4" fill="currentColor" />
      </svg>
    </span>
  );
}

function CoastPreview() {
  return (
    <div className="reel-map" aria-hidden="true">
      <div className="reel-map__bar">
        <span className="reel-map__dot" /> COASTAL RECORDS{" "}
        <span>ILLUSTRATION · © OSM</span>
      </div>
      <div className="reel-map__canvas">
        <svg viewBox="0 0 800 420" fill="none">
          <path
            d={INTRO_COAST_PATH}
            transform="translate(190 0)"
            className="reel-map__coast"
          />
          {ZONES.map((point, index) => (
            <g
              key={index}
              style={{ animationDelay: `${index * 90 + 300}ms` }}
              className="reel-map__pin"
            >
              <circle
                cx={point.x}
                cy={point.y}
                r="17"
                fill="#67b9a318"
                stroke="#67b9a355"
              />
              <circle cx={point.x} cy={point.y} r="5" fill="#8dd2bc" />
            </g>
          ))}
        </svg>
        <div className="reel-map__focus">
          <span />
        </div>
        <div className="reel-map__label">
          PUERTO PRINCESA <small>Seven coastal areas</small>
        </div>
      </div>
      <div className="reel-map__bottom">
        <span>
          <i /> Community records
        </span>
        <span>Check official BFAR bulletins ↗</span>
      </div>
    </div>
  );
}

export function ReportPreview({ step = 'report' }: { step?: 'report' | 'review' | 'warning' }) {
  const receipt = step === 'report'
    ? { title: 'Observation recorded', detail: 'Awaiting admin review', badge: 'PENDING', symbol: '✓' }
    : step === 'review'
      ? { title: 'Admin review', detail: 'A person approves or rejects', badge: 'REVIEW', symbol: '01' }
      : { title: 'Example approved report', detail: 'Can prompt a community warning', badge: 'WARNING', symbol: '!' };
  return (
    <div className={`reel-report reel-report--${step}`} aria-hidden="true" data-workflow-step={step}>
      <div className="reel-report__header">
        <span className="reel-report__label">COMMUNITY OBSERVATION</span>
        <span className="reel-report__example">ILLUSTRATION</span>
      </div>
      <p className="reel-report__prompt">What did you notice?</p>
      <div className="reel-report__field">
        <span
          className="reel-report__typed"
          style={
            {
              "--typing-width": `${OBSERVATION.length}ch`,
              "--typing-steps": OBSERVATION.length,
            } as CSSProperties
          }
        >
          {OBSERVATION}
        </span>
      </div>
      <div className="reel-report__receipt" data-status={step}>
        <span className="reel-report__check">{receipt.symbol}</span>
        <span key={step} className="reel-report__status-copy">
          {receipt.title}<small>{receipt.detail}</small>
        </span>
        <span className="reel-report__pending">{receipt.badge}</span>
      </div>
      <p className="reel-report__note">
        {step === 'warning' ? 'Community warning ≠ laboratory confirmation. Status unavailable ≠ safe water.'
          : 'An observation informs a review. It does not confirm red tide.'}
      </p>
    </div>
  );
}

function SceneVisual({ visual, animated }: { visual: (typeof REEL_SCENES)[number]['visual']; animated: boolean }) {
  switch (visual) {
    case 'orbit': return <div className="reel-orbit" aria-hidden="true"><span /><span /><span /></div>;
    case 'coast': return <CoastPreview />;
    case 'report': return <ReportPreview />;
    case 'review': return <ReviewPreview />;
    case 'warning': return <WarningPreview />;
    case 'source': return <SourcePreview />;
    case 'hardware': return <HardwarePreview />;
    default: return <TideMark animated={visual === 'identity' && animated} />;
  }
}

export function ReelCopy({ scene, reduced = false }: { scene: number; reduced?: boolean }) {
  const current = reduced ? REEL_CLOSING_SCENE : scene;
  const copy = REEL_SCENES[current];
  return <>
    <p className="showroom-eyebrow">{copy.tag}</p>
    <h1><TextReveal text={copy.title} effect="words" trigger="mount" className="reel-text-reveal" /></h1>
    <p className="showroom-description">{copy.description}</p>
    {"detail" in copy && <p className="reel-scene__detail">{copy.detail}</p>}
    {current === REEL_CLOSING_SCENE && !reduced && <p className="reel-scene__disclaimer">School prototype · Check official BFAR advisories.</p>}
    {reduced && <p className="showroom-disclaimer">Reports are reviewed by an admin. Source labels identify sample or cached records. Arduino demonstrates distance sensing, LEDs and a buzzer. Check BFAR for official advisories.</p>}
  </>;
}

export const isWorkflowScene = (scene: number) => scene >= 3 && scene <= 5;

/** One card survives all three chapters; only the explanatory copy crossfades. */
export function WorkflowStage({ scenes, current }: { scenes: number[]; current: number }) {
  const target = scenes[scenes.length - 1];
  const step = target === 3 ? 'report' : target === 4 ? 'review' : 'warning';
  return <div className="reel-scene reel-scene--feature reel-workflow-scene">
    <div className="reel-scene__visual"><ReportPreview step={step} /></div>
    <div className="reel-scene__copy reel-workflow-copy">
      {scenes.map(scene => <div key={scene} aria-hidden={scene !== current ? true : undefined}
        className={`reel-workflow-copy__chapter${scenes.length > 1 ? scene === current ? ' showroom-stage--out' : ' showroom-stage--incoming' : ''}`}>
        <ReelCopy scene={scene} />
      </div>)}
    </div>
  </div>;
}

export function ReelStage({
  scene,
  reduced,
}: {
  scene: number;
  reduced: boolean;
}) {
  const current = reduced ? REEL_CLOSING_SCENE : scene;
  const copy = REEL_SCENES[current];
  const feature = current >= 2 && current < REEL_CLOSING_SCENE;
  return (
    <div
      key={current}
      className={`reel-scene reel-scene--${current}${feature ? " reel-scene--feature" : ""}${current === REEL_CLOSING_SCENE ? " reel-scene--closing" : ""}${reduced ? " reel-scene--static" : ""}`}
    >
      <div className="reel-scene__visual">
        <SceneVisual visual={copy.visual} animated={!reduced} />
      </div>
      <div className="reel-scene__copy">
        <ReelCopy scene={current} reduced={reduced} />
      </div>
    </div>
  );
}
