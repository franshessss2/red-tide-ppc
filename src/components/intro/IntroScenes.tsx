import type { CSSProperties } from 'react'
import { motion } from 'motion/react'
import { MOTION } from '../../motion/tokens'
import { useReducedMotion } from '../../motion/preferences'
import { PhoneMock } from './PhoneMock'
import '../../styles/intro-scenes.css'

/**
 * The five tap-to-advance scenes layered over the PR57 intro (PR59).
 *
 * Scene 0 is the PR57 wave loop itself, owned by SplashScreen; this module
 * renders scenes 1–5. Nothing here advances on a timer: the only intra-scene
 * motion is CSS stagger/crossfade (transform and opacity only), and the next
 * scene always waits for the next tap.
 *
 * The copy below is fixed, verbatim. Tests assert these exact strings.
 */
export const INTRO_SCENE_COUNT = 5

export const INTRO_SCENE_COPY: Readonly<Record<number, readonly string[]>> = {
  1: ['Pula ang dagat.', 'Red tide.'],
  2: ['The sea can look normal.', 'The shellfish can still make you sick.', 'Cooking does not make it safe.'],
  3: ['See every zone.'],
  4: ['Report what you see.', 'Reviewed before an advisory is raised.'],
  5: ['One coast. A shared watch.', 'Community reports. Not a substitute for a BFAR advisory.'],
}

/** Screen-reader announcement for the polite live region in SplashScreen. */
export function sceneAnnouncement(scene: number): string {
  const copy = INTRO_SCENE_COPY[scene]
  if (!copy) return ''
  return `Step ${scene} of ${INTRO_SCENE_COUNT}. ${copy.join(' ')}`
}

function SceneBody({ scene, showPhone }: { scene: number; showPhone: boolean }) {
  switch (scene) {
    case 1:
      return (
        <>
          <p className="tide-scene__kicker" lang="fil">Pula ang dagat.</p>
          <p className="tide-scene__headline">Red tide.</p>
        </>
      )
    case 2:
      return (
        <>
          {INTRO_SCENE_COPY[2].map((line, index) => (
            <p
              key={line}
              className="tide-scene__line"
              style={{ '--line-index': index } as CSSProperties}
            >
              {line}
            </p>
          ))}
        </>
      )
    case 3:
      return (
        <>
          <div className="tide-product-copy"><p className="tide-scene__headline tide-scene__headline--md">See every zone.</p></div>
          {showPhone ? <PhoneMock variant="zones" /> : <div className="tide-phone-space" aria-hidden="true" />}
        </>
      )
    case 4:
      return (
        <>
          <div className="tide-product-copy"><p className="tide-scene__line tide-scene__line--lead" style={{ '--line-index': 0 } as CSSProperties}>
            Report what you see.
          </p>
          <p className="tide-scene__line" style={{ '--line-index': 1 } as CSSProperties}>
            Reviewed before an advisory is raised.
          </p>
          </div>
          {showPhone ? <PhoneMock variant="report" /> : <div className="tide-phone-space" aria-hidden="true" />}
        </>
      )
    case 5:
      return (
        <>
          <p className="tide-scene__closing">One coast. A shared watch.</p>
          <p className="tide-scene__fine">Community reports. Not a substitute for a BFAR advisory.</p>
          <div className="tide-scene__hint" aria-hidden="true">TAP TO ENTER</div>
        </>
      )
    default:
      return null
  }
}

/**
 * One rendered scene. `state` is 'in' for the current scene and 'out' for
 * the retained outgoing panel; a tap mid-transition simply drops the
 * ghost (the transition "completes") and shows the next scene.
 */
export function IntroScene({ scene, state, showPhone = true }: { scene: number; state: 'in' | 'out'; showPhone?: boolean }) {
  const reduce = useReducedMotion()
  if (scene < 1 || scene > INTRO_SCENE_COUNT) return null
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={state === 'in' ? { opacity: 1, y: 0 } : { opacity: 0, y: reduce ? 0 : -12 }}
      transition={{ duration: reduce ? 0 : state === 'in' ? MOTION.time.introSceneIn : MOTION.time.introSceneOut, ease: MOTION.ease.out }}
      aria-hidden={state === 'out' ? true : undefined}
      className={`tide-scene tide-scene--${state}${scene === INTRO_SCENE_COUNT ? ' tide-scene--final' : ''}`}
      data-scene-panel={scene}
    >
      <SceneBody scene={scene} showPhone={showPhone} />
    </motion.div>
  )
}
