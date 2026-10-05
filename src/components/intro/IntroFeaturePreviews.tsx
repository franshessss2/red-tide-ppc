/** Decorative product studies. These never fetch data or operate a device. */
function PanelHeader({ label }: { label: string }) {
  return <div className="reel-study__header"><span>{label}</span><span>ILLUSTRATION</span></div>;
}

export function ReviewPreview() {
  return <div className="reel-study reel-review" aria-hidden="true">
    <PanelHeader label="REVIEW WORKFLOW" />
    <div className="reel-review__step"><span className="reel-study__number">01</span><div><strong>Observation received</strong><small>Description · optional photo</small></div><span className="reel-study__badge">PENDING</span></div>
    <div className="reel-review__connector"><span /></div>
    <div className="reel-review__step"><span className="reel-study__number">02</span><div><strong>Admin review</strong><small>A person decides: approve or reject</small></div><span className="reel-review__check">✓</span></div>
    <div className="reel-study__foot">Approved reports can prompt a community warning.</div>
  </div>;
}

export function WarningPreview() {
  return <div className="reel-study reel-warning" aria-hidden="true">
    <PanelHeader label="COMMUNITY STATUS" />
    <div className="reel-warning__row"><span className="reel-warning__symbol">!</span><div><strong>Community warning</strong><small>A warning is recorded for this area.</small></div></div>
    <div className="reel-warning__row reel-warning__row--unknown"><span className="reel-warning__symbol">?</span><div><strong>Status unavailable</strong><small>The area's status cannot be established.</small></div></div>
    <div className="reel-study__foot">Community status is separate from official BFAR advice.</div>
  </div>;
}

export function SourcePreview() {
  return <div className="reel-study reel-source" aria-hidden="true">
    <PanelHeader label="RECORD PROVENANCE" />
    <div className="reel-source__row"><span className="reel-source__icon">S</span><div><strong>Sample data</strong><small>Local demonstration records</small></div></div>
    <div className="reel-source__row"><span className="reel-source__icon">C</span><div><strong>Cached copy</strong><small>A previously received record</small></div></div>
    <div className="reel-source__row"><span className="reel-source__icon">↗</span><div><strong>Server delivery</strong><small>Sync describes delivery, not water testing</small></div></div>
    <div className="reel-study__foot">These are label examples, not a live feed.</div>
  </div>;
}

export function HardwarePreview() {
  return <div className="reel-study reel-hardware" aria-hidden="true">
    <PanelHeader label="ARDUINO UNO · USB" />
    <div className="reel-hardware__diagram">
      <div className="reel-hardware__device"><span className="reel-hardware__ports" /><strong>UNO</strong><small>USB commands</small><span className="reel-hardware__ports" /></div>
      <div className="reel-hardware__link"><span /><i /></div>
      <div className="reel-hardware__outputs">
        <div><span className="reel-hardware__scan"><i /></span><strong>Distance scan</strong></div>
        <div><span className="reel-hardware__leds"><i /><i /><i /></span><strong>LED test</strong></div>
        <div><span className="reel-hardware__sound">♪</span><strong>Manual beep</strong></div>
      </div>
    </div>
    <div className="reel-study__foot">Illustrated connection · permission required on the hardware page</div>
  </div>;
}
