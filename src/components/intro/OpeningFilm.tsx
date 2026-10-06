import { useCallback, useEffect, useRef, useState } from 'react'
import '../../styles/opening-film.css'

export const OPENING_FADE_MS = 450
const LOAD_TIMEOUT_MS = 8000
const STALL_TIMEOUT_MS = 10000

/** The supplied film precedes the showroom once; it never loops or navigates. */
export function OpeningFilm({ onComplete }: { onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  const finishing = useRef(false)
  const [leaving, setLeaving] = useState(false)
  const [muted, setMuted] = useState(false)
  const [blocked, setBlocked] = useState(false)
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
        setMuted(true)
        try { await video.play() }
        catch { if (!cancelled && !finishing.current) setBlocked(true) }
      }
    }
    const progress = () => {
      if (video.currentTime > lastTime) {
        lastTime = video.currentTime
        setBlocked(false)
        arm(STALL_TIMEOUT_MS)
      }
    }
    const visibility = () => {
      clearTimeout(watchdog)
      if (document.hidden) video.pause()
      else { arm(STALL_TIMEOUT_MS); void play() }
    }
    continueRef.current?.focus({ preventScroll: true })
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

  const sound = async () => {
    const video = videoRef.current!
    const next = !video.muted
    video.muted = next
    setMuted(next)
    try { await video.play(); setBlocked(false) }
    catch { video.muted = true; setMuted(true); setBlocked(true) }
  }

  return <div className={`opening-film${leaving ? ' opening-film--leaving' : ''}`}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish() }
      if (event.key === 'Tab') {
        event.preventDefault(); event.stopPropagation()
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
      }
    }}>
    <video ref={videoRef} playsInline preload="auto" poster="/media/opening-poster.jpg"
      src="/media/opening-reference.mp4" aria-label="Google AI Studio reference film"
      onEnded={finish} onError={finish} />
    <div className="opening-film-actions">
      <button type="button" onClick={sound} disabled={leaving} aria-pressed={!muted}>
        {muted ? 'Sound off' : 'Sound on · 50%'}
      </button>
      <button ref={continueRef} type="button" onClick={finish} disabled={leaving}>Continue to Red Tide</button>
    </div>
    {blocked && <p className="opening-film-notice" role="status">Playback is blocked. Continue to the introduction.</p>}
  </div>
}
