import { motion } from 'motion/react'
import { useReducedMotion } from '../../motion/preferences'

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
export function PhoneMock({ variant, persistent = false }: { variant: 'zones' | 'report'; persistent?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <div className={`intro-phone intro-phone--${variant}${persistent ? ' intro-phone--persistent' : ''}`} aria-hidden="true">
      <div className="intro-phone__screen">
        <motion.span
          className="intro-phone__selected-zone"
          layout
          initial={false}
          style={{ top: variant === 'report' ? '5%' : '24%', height: variant === 'report' ? '5%' : '12%', width: variant === 'report' ? '68%' : '84%' }}
          transition={{ duration: reduce ? 0 : .5, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="intro-phone__content intro-phone__content--zones">
            <span className="intro-phone__band intro-phone__band--safe" style={{ flexGrow: 3 }} />
            <span className="intro-phone__band intro-phone__band--amber" style={{ flexGrow: 2 }} />
            <span className="intro-phone__band intro-phone__band--safe" style={{ flexGrow: 4 }} />
            <span className="intro-phone__band intro-phone__band--red" style={{ flexGrow: 3 }} />
            <span className="intro-phone__band intro-phone__band--safe" style={{ flexGrow: 2 }} />
        </div>
        <div className="intro-phone__content intro-phone__content--report">
            <span className="intro-phone__line" style={{ width: '72%' }} />
            <span className="intro-phone__line" style={{ width: '88%' }} />
            <span className="intro-phone__line" style={{ width: '56%' }} />
            <span className="intro-phone__field" />
            <span className="intro-phone__status">
              <span className="intro-phone__status-swap" />
            </span>
        </div>
      </div>
    </div>
  )
}
