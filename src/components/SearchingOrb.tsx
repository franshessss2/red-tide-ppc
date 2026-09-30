import { useEffect, useRef } from 'react'
import { usePageVisible, useReducedMotion } from '../motion/preferences'

const SIZE = 56
const DPR_CAP = 1.5
const AMBER = 'rgba(240,165,0,'
const TEAL = '#4a8a75'
const TOTAL_DOTS = 96

function drawSearchingOrb(
  ctx: CanvasRenderingContext2D,
  size: number,
  time: number,
  reduced: boolean,
) {
  const center = size / 2
  const radius = size * 0.39
  ctx.clearRect(0, 0, size, size)
  ctx.lineCap = 'round'

  // A dotted globe projected from latitude/longitude samples.
  for (let i = 0; i < TOTAL_DOTS; i += 1) {
    const latIndex = Math.floor(i / 12)
    const lonIndex = i % 12
    const lat = -1.05 + (latIndex / 7) * 2.1
    const lon = (lonIndex / 12) * Math.PI * 2

    const x3 = Math.cos(lat) * Math.cos(lon)
    const y3 = Math.sin(lat)
    const z3 = Math.cos(lat) * Math.sin(lon)

    const depth = 0.52 + z3 * 0.48
    const x = center + x3 * radius
    const y = center + y3 * radius
    const dotRadius = 0.7 + depth * 0.65
    const alpha = 0.16 + depth * 0.58

    ctx.fillStyle = AMBER + alpha.toFixed(3) + ')'
    ctx.beginPath()
    ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(240,165,0,0.12)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.stroke()

  const phase = reduced ? 0.45 : time
  const sweep = phase * 1.15
  const meridianWidth = Math.max(1.5, Math.abs(Math.cos(sweep)) * radius)

  // Searching state: a meridian sweeps across the dotted globe.
  ctx.strokeStyle = TEAL
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 1.15
  ctx.beginPath()
  ctx.ellipse(center, center, meridianWidth, radius, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.globalAlpha = 0.38
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(center, center - radius)
  ctx.lineTo(center, center + radius)
  ctx.stroke()
  ctx.globalAlpha = 1
}

export function SearchingOrb({
  size = SIZE,
  className,
}: {
  size?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reduce = useReducedMotion()
  const visible = usePageVisible()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.min(
      DPR_CAP,
      (typeof window !== 'undefined' && window.devicePixelRatio) || 1,
    )
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    canvas.style.width = size + 'px'
    canvas.style.height = size + 'px'

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let running = false
    let intersectionVisible = true

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawSearchingOrb(ctx, size, reduce ? 0.45 : now / 1000, reduce)
    }

    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
      raf = 0
    }

    const start = () => {
      if (running || reduce || !intersectionVisible || !visible) return
      running = true
      const loop = (now: number) => {
        if (!running) return
        draw(now)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    draw(0)

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            intersectionVisible = entry.isIntersecting
            if (intersectionVisible && visible) start()
            else stop()
          })
        : null

    observer?.observe(canvas)

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') stop()
      else if (intersectionVisible && visible) start()
    }

    document.addEventListener('visibilitychange', handleVisibility)

    if (!reduce && visible) start()

    return () => {
      stop()
      observer?.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [reduce, size, visible])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label="Searching"
      width={size}
      height={size}
    />
  )
}
