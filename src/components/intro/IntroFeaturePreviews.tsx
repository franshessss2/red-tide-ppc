/** Decorative examples only; never submit records or connect hardware. */
export type ObservationStep = 'report' | 'review' | 'shared'
export function PanelHeader({ label }: { label: string }) {
  return <div className="coast-panel-head">
    <span>
      <i />{label}</span>
    <small>ILLUSTRATION</small>
  </div>
}
export function SharedDevices({ compact = false }: { compact?: boolean }) {
  return <div className={`coast-devices${compact ? ' coast-devices--compact' : ''}`} aria-hidden="true">{(['Website', 'Android', 'Windows'] as const).map((name, index) => <div key={name} className="coast-device" style={{ animationDelay: `${index * 110}ms` }}>
    <svg viewBox="0 0 48 36" fill="none">{name === 'Android' ? <>
      <rect x="15" y="2" width="18" height="32" rx="4" />
      <path d="M21 6h6M22 29h4M19 12h10v10H19z" />
    </> : <>
      <rect x="3" y="3" width="42" height="26" rx="3" />
      <path d={name === 'Website' ? 'M3 10h42M8 6h1m4 0h1m4 0h1' : 'M17 34h14M24 29v5M19 11h4v4h-4zm6 0h4v4h-4zm-6 6h4v4h-4zm6 0h4v4h-4z'} />
    </>}</svg>
    <strong>{name}</strong>
    <span>
      <i />Shared records</span>
  </div>)}</div>
}
export function ObservationCard({ step = 'report' }: { step?: ObservationStep }) {
  const status = step === 'report' ? ['Observation received', 'Awaiting admin review', 'PENDING', '↗'] : step === 'review' ? ['Human review', 'Approve or reject manually', 'IN REVIEW', '01'] : ['Reviewed observation', 'Available to connected apps', 'REVIEWED', '✓']
  return <div className={`coast-workflow coast-workflow--${step}`} aria-hidden="true">
    <div className="reel-report" data-workflow-step={step}>
      <PanelHeader label="ONE COMMUNITY OBSERVATION" />
      <div className="coast-observation-location">
        <span>↗</span>PUERTO PRINCESA BAY<small>EXAMPLE RECORD</small>
      </div>
      <div className="reel-report__field">
        <span className="reel-report__typed">Unusual water colour</span>
      </div>
      <p className="coast-observation-note">A change in water colour near the shore.</p>
      <div className="reel-report__receipt" data-status={step}>
        <span className="reel-report__check" key={`glyph-${step}`}>{step === 'review' ? <svg className="coast-review-glyph" viewBox="0 0 30 30" fill="none">
          <path d="M6 5h12v7M6 5v19h7M9 10h5M9 14h3" />
          <g><circle cx="18" cy="18" r="5" /><path d="m22 22 4 4" /></g>
        </svg> : step === 'shared' ? <svg className="coast-reviewed-glyph" viewBox="0 0 30 30" fill="none">
          <path pathLength="1" d="m7 15 5 5L24 8" />
        </svg> : status[3]}</span>
        <span className="reel-report__status-copy" key={step}>{status[0]}<small>{status[1]}</small>
        </span>
        <span className="reel-report__pending">{status[2]}</span>
      </div>
      <div className="coast-record-footer">
        <span className="coast-record-avatar">C</span>
        <span>Community observation<small>Reviewed by a person. Never an automatic clearance.</small>
        </span>
      </div>
    </div>
    <div className="coast-record-journey">
      <span className="is-reached">01 Observe</span>
      <i />
      <span className={step !== 'report' ? 'is-reached' : ''}>02 Review</span>
      <i />
      <span className={step === 'shared' ? 'is-reached' : ''}>03 Share</span>
    </div>
    <div className="coast-shared-destination">
      <SharedDevices compact />
    </div>
  </div>
}
