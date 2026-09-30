import { useEffect, useLayoutEffect, useState } from 'react'
import { motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { useReducedMotion } from '../motion/preferences'

const RADIUS = 120
const MAX_SCALE = 1.08

export function TextPressure({ text, className = '' }: { text: string; className?: string }) {
  const reduce = useReducedMotion()
  const [coarse, setCoarse] = useState(true)
  const pointerX = useMotionValue(-10000)
  const pointerY = useMotionValue(-10000)

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const sync = () => setCoarse(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  if (reduce || coarse) {
    return <span className={`inline-block ${className}`}>{text}</span>
  }

  return (
    <span
      className={`inline-block whitespace-nowrap ${className}`}
      onPointerMove={(event) => {
        pointerX.set(event.clientX)
        pointerY.set(event.clientY)
      }}
      onPointerLeave={() => {
        pointerX.set(-10000)
        pointerY.set(-10000)
      }}
      aria-hidden="true"
    >
      {Array.from(text).map((char, index) => (
        <PressureLetterLive
          key={`${char}-${index}`}
          char={char}
          index={index}
          pointerX={pointerX}
          pointerY={pointerY}
        />
      ))}
    </span>
  )
}

function PressureLetterLive({
  char,
  index,
  pointerX,
  pointerY,
}: {
  char: string
  index: number
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
}) {
  const [center, setCenter] = useState({ x: -10000, y: -10000 })

  useLayoutEffect(() => {
    const node = document.querySelector<HTMLElement>(`[data-text-pressure-letter="${index}"]`)
    if (!node) return

    const measure = () => {
      const rect = node.getBoundingClientRect()
      setCenter({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [index])

  const scale = useTransform(() => {
    const dx = pointerX.get() - center.x
    const dy = pointerY.get() - center.y
    const distance = Math.hypot(dx, dy)
    const influence = Math.max(0, 1 - distance / RADIUS)
    return 1 + (MAX_SCALE - 1) * influence
  })

  return (
    <motion.span
      data-text-pressure-letter={index}
      style={{ scale, display: 'inline-block', transformOrigin: '50% 100%' }}
    >
      {char}
    </motion.span>
  )
}
