/**
 * A deliberately generic handset: one rounded rectangle and an abstract
 * screen. No notch, no camera, no logo, no brand name, no recognizable
 * device design — the point is "a phone", not any particular phone.
 *
 * Screen content is abstract only. The 'zones' variant shows horizontal
 * status bands in the app's existing teal/amber/red variables; the 'report'
 * variant shows report-form shapes and a status band whose change is an
 * opacity-only crossfade (amber under, red over). No map data is imported
 * or drawn — see the static no-forbidden-imports test.
 */
export function PhoneMock({ variant }: { variant: 'zones' | 'report' }) {
  return (
    <div className={`intro-phone intro-phone--${variant}`} aria-hidden="true">
      <div className="intro-phone__screen">
        {variant === 'zones' ? (
          <>
            <span className="intro-phone__band intro-phone__band--safe" style={{ flexGrow: 3 }} />
            <span className="intro-phone__band intro-phone__band--amber" style={{ flexGrow: 2 }} />
            <span className="intro-phone__band intro-phone__band--safe" style={{ flexGrow: 4 }} />
            <span className="intro-phone__band intro-phone__band--red" style={{ flexGrow: 3 }} />
            <span className="intro-phone__band intro-phone__band--safe" style={{ flexGrow: 2 }} />
          </>
        ) : (
          <>
            <span className="intro-phone__line" style={{ width: '72%' }} />
            <span className="intro-phone__line" style={{ width: '88%' }} />
            <span className="intro-phone__line" style={{ width: '56%' }} />
            <span className="intro-phone__field" />
            <span className="intro-phone__status">
              <span className="intro-phone__status-swap" />
            </span>
          </>
        )}
      </div>
    </div>
  )
}
