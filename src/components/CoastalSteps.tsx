import { motion } from 'motion/react'
import { useDecorativeMotionDisabled } from '../motion/LandingMotionPolicy'

const steps = [
  { title: 'Find your shore', text: 'Our seven zones cover the coast, from the city bay to St. Paul Bay.' },
  { title: 'Share what you see', text: 'Report an observation — describe what you see in at least 10 characters.' },
  { title: 'Community review', text: 'An admin reviews community reports — a reviewed report can prompt a community warning. Check BFAR for official bulletins.' },
]

/** Original inline illustrations: no image request, canvas or animation dependency added. */
export function CoastalSteps() {
  const disabled = useDecorativeMotionDisabled()
  const still = disabled || typeof IntersectionObserver === 'undefined'
  return <section className="coastal-steps" aria-labelledby="coastal-steps-title" data-motion={still ? 'static' : 'enabled'}>
    <div className="mb-6 flex items-end justify-between gap-4">
      <div><p className="mb-2 font-mono text-[10px] uppercase tracking-[.18em] text-accent">Shore to community</p><h2 id="coastal-steps-title" className="text-lg font-semibold text-paper">How it works</h2></div>
      <span aria-hidden="true" className="font-mono text-xs text-faint">01 — 03</span>
    </div>
    <ol className="coastal-steps__list">
      {steps.map((step, index) => <li key={step.title} className="coastal-step">
        <div className="coastal-step__art" aria-hidden="true">
          <motion.div initial={false} whileInView={still ? undefined : { y: [4, 0] }} viewport={{ once: true, amount: .5 }} transition={{ duration: .6, delay: index * .08 }}>
          <svg viewBox="0 0 280 92" fill="none">
            <path className="coastal-step__grid" d="M0 68h280M0 44h280M40 0v92M140 0v92M240 0v92" />
            {index === 0 && <><path className="coastal-step__shore" d="m0 78 30-5 17-18 27 4 22-23 23 6 24-19 20 5 17-15 28 6 25-12 47 3" /><path className="coastal-step__contour" d="m0 89 38-6 17-17 26 4 22-23 21 6 24-19 20 5 19-15 24 7 23-13 46 4" /><circle className="coastal-step__marker" cx="143" cy="23" r="6" /><circle className="coastal-step__contour" cx="143" cy="23" r="13" /></>}
            {index === 1 && <><rect className="coastal-step__contour" x="76" y="13" width="128" height="66" rx="8" /><path className="coastal-step__shore" d="M94 32h56M94 44h80M94 56h40m43 7 14-14m-14 0h14v14" /><circle className="coastal-step__marker" cx="193" cy="20" r="5" /></>}
            {index === 2 && <><path className="coastal-step__contour" d="M55 46h170" /><circle className="coastal-step__contour" cx="55" cy="46" r="8" /><circle className="coastal-step__contour" cx="225" cy="46" r="8" /><circle className="coastal-step__shield" cx="140" cy="46" r="29" /><path className="coastal-step__shore" d="m127 46 9 9 17-18" /></>}
          </svg>
          </motion.div>
          <span className="coastal-step__number">0{index + 1}</span>
        </div>
        <h3 className="mt-4 text-base font-medium text-paper">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
      </li>)}
    </ol>
  </section>
}
