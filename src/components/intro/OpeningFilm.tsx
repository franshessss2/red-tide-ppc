import { useCallback, useEffect, useRef, useState } from 'react'
import '../../styles/opening-film.css'

export const OPENING_FADE_MS = 450
const LOAD_TIMEOUT_MS = 8000
const STALL_TIMEOUT_MS = 10000

/** The supplied film precedes each full introduction; it never loops or navigates. */
export function OpeningFilm({ onComplete }: { onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const filmRef = useRef<HTMLDivElement>(null)
  const finishing = useRef(false)
  const [leaving, setLeaving] = useState(false)
  const finish = useCallback(() => {
    if (finishing.current) return
    finishing.current = true
    videoRef.current?.pause()
    setLeaving(true)
  }, [])

  useEffect(() => {
    const video = videoRef.current!
    let cancelled = false
    let watchdog: ReturnType<typeof setTimeout> | undefined
    let lastTime = -1
    const arm = (ms: number) => {
      clearTimeout(watchdog)
      if (!document.hidden) watchdog = setTimeout(finish, ms)
    }
    const play = async () => {
      if (cancelled || finishing.current || document.hidden) return
      try { await video.play() }
      catch {
        if (cancelled || finishing.current) return
        // Autoplay with audio is policy-dependent. Keep the film moving muted.
        video.muted = true
        try { await video.play() }
        catch { if (!cancelled && !finishing.current) finish() }
      }
    }
    const progress = () => {
      if (video.currentTime > lastTime) {
        lastTime = video.currentTime
        arm(STALL_TIMEOUT_MS)
      }
    }
    const visibility = () => {
      clearTimeout(watchdog)
      if (document.hidden) video.pause()
      else { arm(STALL_TIMEOUT_MS); void play() }
    }
    filmRef.current?.focus({ preventScroll: true })
    // Audio gain is baked at 0.5 into the file, including on mobile devices
    // that ignore HTMLMediaElement.volume. Do not halve it a second time.
    arm(LOAD_TIMEOUT_MS)
    void play()
    video.addEventListener('timeupdate', progress)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelled = true
      clearTimeout(watchdog)
      video.pause()
      video.removeEventListener('timeupdate', progress)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [finish])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(onComplete, OPENING_FADE_MS)
    return () => clearTimeout(timer)
  }, [leaving, onComplete])

  return <div ref={filmRef} tabIndex={-1} className={`opening-film${leaving ? ' opening-film--leaving' : ''}`}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish() }
      if (event.key === 'Tab') {
        event.preventDefault(); event.stopPropagation()
        filmRef.current?.focus()
      }
    }}>
    <video ref={videoRef} playsInline preload="auto" poster="/media/opening-peak-poster.jpg"
      src="/media/opening-peak.mp4" aria-label="Opening film"
      onEnded={finish} onError={finish} />

  </div>
}
