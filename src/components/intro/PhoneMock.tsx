import { motion } from 'motion/react'
import '../../styles/intro-scenes.css'
import { useReducedMotion } from '../../motion/preferences'
import { MOTION } from '../../motion/tokens'

/**
 * A deliberately generic handset: one rounded rectangle and an abstract
 * screen. No notch, no camera, no logo, no brand name, no recognizable
 * device design — the point is "a phone", not any particular phone.
 *
 * Screen content is abstract only. The 'zones' variant shows horizontal
 * status bands in the app's existing teal/amber/red variables; the 'report'
 * variant shows report-form shapes and an amber receipt awaiting review.
 * A report never turns into an advisory in this graphic. No map data is imported
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
          style={{
            // Match the second flex band exactly, including padding and four gaps.
            top: variant === 'report' ? 'var(--phone-inset)' : 'calc(var(--phone-inset) + var(--phone-gap) + (100% - 2 * var(--phone-inset) - 4 * var(--phone-gap)) * 3 / 14)',
            height: variant === 'report' ? 'var(--phone-line-height)' : 'calc((100% - 2 * var(--phone-inset) - 4 * var(--phone-gap)) * 2 / 14)',
            width: variant === 'report' ? 'calc((100% - 2 * var(--phone-inset)) * .72)' : 'calc(100% - 2 * var(--phone-inset))',
            borderRadius: 4,
          }}
          transition={{ duration: reduce ? 0 : MOTION.time.introSceneIn, ease: MOTION.ease.out }}
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
              <span className="intro-phone__receipt">
                <span className="intro-phone__pending" />
                <span className="intro-phone__receipt-lines"><span /><span /></span>
              </span>
            </span>
        </div>
      </div>
    </div>
  )
}
