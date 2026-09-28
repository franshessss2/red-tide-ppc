/** Shared seconds, physics, easing and layer order. CSS receives these from MotionProvider. */
export const MOTION = {
  time: {
    instant: 0, fast: 0.14, base: 0.22, reveal: 0.38, exit: 0.22,
    routeOut: 0.35, routeIn: 0.4, pulse: 0.55, count: 0.9, countUpdate: 0.6,
    stagger: 0.065, staggerLimit: 0.32, wash: 0.8,
    camera: 0.9, mapIntro: 2.8, introHold: 2.6, introExit: 1.05,
    successHold: 1.6, noticeHold: 7, advisoryLoop: 3.5, statusLoop: 2.4,
    waveTint: 1.5, observerFallback: 0.7, idle: 1.2, sheen: 1.1,
    tideDrift: 9, scan: 14, ambient: 44, ambientSecond: 52, ambientPanel: 60,
  },
  ease: {
    out: [0.22, 1, 0.36, 1] as const,
    in: [0.42, 0, 1, 1] as const,
    tide: [0.76, 0, 0.24, 1] as const,
  },
  spring: { type: 'spring', stiffness: 420, damping: 34, mass: 0.85 } as const,
  layers: { map: 0, loading: 1005, chrome: 1010, controls: 1015, modal: 1030, notice: 1100, intro: 1200 },
} as const

export function tween(reduce: boolean, duration: number = MOTION.time.base, delay = 0) {
  return { duration: reduce ? 0 : duration, delay: reduce ? 0 : delay, ease: MOTION.ease.out }
}
export function spring(reduce: boolean) {
  return reduce ? { duration: 0 } : MOTION.spring
}
export function staggerDelay(index: number, reduce = false, step: number = MOTION.time.stagger) {
  return reduce || !Number.isFinite(index) ? 0 : Math.min(Math.max(0, index) * step, MOTION.time.staggerLimit)
}
export const easeOut = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3

export const motionCSSVariables: Record<string, string> = {
  ...Object.fromEntries(Object.entries(MOTION.time).map(([name, value]) => [`--motion-${name.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`, `${value * 1000}ms`])),
  ...Object.fromEntries(Object.entries(MOTION.layers).map(([name, value]) => [`--layer-${name}`, String(value)])),
  '--ease-out-quint': `cubic-bezier(${MOTION.ease.out.join(',')})`,
  '--ease-in': `cubic-bezier(${MOTION.ease.in.join(',')})`,
  '--ease-tide': `cubic-bezier(${MOTION.ease.tide.join(',')})`,
  '--default-transition-duration': `${MOTION.time.base * 1000}ms`,
  '--default-transition-timing-function': `cubic-bezier(${MOTION.ease.out.join(',')})`,
  '--dur-fast': `${MOTION.time.fast * 1000}ms`,
  '--dur-base': `${MOTION.time.base * 1000}ms`,
  '--dur-slow': `${MOTION.time.reveal * 1000}ms`,
}
