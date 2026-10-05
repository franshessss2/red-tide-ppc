import type { CSSProperties } from "react";
import { INTRO_COAST_PATH } from "../../data/introCoast";

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

export function ReportPreview() {
  return (
    <div className="reel-report" aria-hidden="true">
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
      <div className="reel-report__receipt">
        <span className="reel-report__check">✓</span>
        <span>
          Observation recorded<small>Awaiting admin review</small>
        </span>
        <span className="reel-report__pending">PENDING</span>
      </div>
      <p className="reel-report__note">
        An observation informs a review. It does not confirm red tide.
      </p>
    </div>
  );
}

const COPY = [
  {
    tag: "RED TIDE · PRODUCT OVERVIEW",
    title: "Introducing",
    description: "A shared view of the coast.",
  },
  {
    tag: "PUERTO PRINCESA · PALAWAN",
    title: "RED TIDE",
    description: "Explore. Observe. Stay informed.",
  },
  {
    tag: "01 / EXPLORE",
    title: "Explore coastal zones.",
    description: "Find your coastal area. Read the community record.",
  },
  {
    tag: "02 / OBSERVE → REVIEW",
    title: "Report observations.",
    description: "Share what you notice. An admin reviews every report.",
  },
  {
    tag: "COMMUNITY COASTAL MONITORING",
    title: "RED TIDE",
    description:
      "Explore the coast. Share observations. Follow community warnings.",
  },
];

export function ReelStage({
  scene,
  reduced,
}: {
  scene: number;
  reduced: boolean;
}) {
  const current = reduced ? 4 : scene;
  const copy = COPY[current];
  return (
    <div
      key={current}
      className={`reel-scene reel-scene--${current}${reduced ? " reel-scene--static" : ""}`}
    >
      <div className="reel-scene__visual">
        {current === 0 ? (
          <div className="reel-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : current === 2 ? (
          <CoastPreview />
        ) : current === 3 ? (
          <ReportPreview />
        ) : (
          <TideMark animated={current === 1 && !reduced} />
        )}
      </div>
      <div className="reel-scene__copy">
        <p className="showroom-eyebrow">{copy.tag}</p>
        <h1>
          <span>{copy.title}</span>
        </h1>
        <p className="showroom-description">{copy.description}</p>
        {current === 4 && !reduced && (
          <p className="reel-scene__disclaimer">
            School prototype · Check official BFAR advisories.
          </p>
        )}
        {reduced && (
          <p className="showroom-disclaimer">
            Reports are reviewed by an admin. Check BFAR for official
            advisories.
          </p>
        )}
      </div>
    </div>
  );
}
