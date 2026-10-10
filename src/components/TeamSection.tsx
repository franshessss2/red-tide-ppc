import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TEAM_MEMBERS, TEAM_SECTION_ENABLED, type TeamMember } from '../data/team'
import { useReducedMotion } from '../motion/preferences'
import { createVideoSlot, type VideoSlot, type VideoSlotToken } from '../motion/videoSlot'
import { TextReveal } from './TextReveal'
import '../styles/team.css'

/**
 * The landing "Team" strip.
 *
 * It replaced the report-activity calendar above the footer and has to stay
 * inside that footprint — see `src/styles/team.css` for the height budget.
 *
 * MEDIA POLICY (all three rules are enforced here, not by CSS)
 * ------------------------------------------------------------
 *  1. **Nothing decodes before the card is ~50% in view.** The `<video>` is
 *     not merely hidden: it is not in the DOM. An `IntersectionObserver` with a
 *     0.5 threshold decides when a card may even ask for a decoder, so a card
 *     below the fold costs no bytes and no decoder. A browser with no
 *     `IntersectionObserver` never mounts one at all — the poster is the card.
 *  2. **At most one team video decodes at once.** All three cards share a
 *     single permit (`createVideoSlot(1)`); the others queue and play in turn.
 *  3. **The video unmounts after the crossfade.** The clip plays once over the
 *     poster, crossfades back to it, and only then leaves the DOM with its
 *     source dropped, which is what actually releases the decoder and hands the
 *     permit to the next card.
 *
 * Reduced motion stops at the poster: no clip is ever mounted.
 */
export const TEAM_VIDEO_IN_VIEW_RATIO = 0.5
/** Poster ↔ clip crossfade, in both directions. */
export const TEAM_VIDEO_CROSSFADE_MS = 380
/** No first frame inside this window: keep the poster, give the permit back. */
export const TEAM_VIDEO_STALL_MS = 4000
/** Hard ceiling on how long one card may hold the single decoder. */
export const TEAM_VIDEO_MAX_MS = 12000

export function TeamSection({
  members = TEAM_MEMBERS,
  enabled = TEAM_SECTION_ENABLED,
}: {
  members?: readonly TeamMember[]
  /** Single on/off switch; defaults to `TEAM_SECTION_ENABLED` in the data module. */
  enabled?: boolean
} = {}) {
  const reduceMotion = useReducedMotion()
  // One permit for the whole strip. This is the "one decoder at a time" rule.
  const slot = useMemo(() => createVideoSlot(1), [])

  // While the roster is still placeholders the strip renders nothing at all.
  if (!enabled) return null

  return (
    <section className="team" aria-labelledby="team-title">
      <div className="team__header">
        <h2 id="team-title"><TextReveal text="The team" /></h2>
        <p>Three students built this prototype for the coastal communities of Puerto Princesa.</p>
      </div>
      <ul className="team__grid">
        {members.map((member) => (
          <TeamCard
            key={member.id}
            member={member}
            slot={slot}
            reduceMotion={reduceMotion}
          />
        ))}
      </ul>
    </section>
  )
}

function TeamCard({
  member,
  slot,
  reduceMotion,
}: {
  member: TeamMember
  slot: VideoSlot
  reduceMotion: boolean
}) {
  const cardRef = useRef<HTMLLIElement>(null)
  const token = useMemo<VideoSlotToken>(() => Symbol(`team:${member.id}`), [member.id])
  const [inView, setInView] = useState(false)
  const [permitted, setPermitted] = useState(false)
  const [settled, setSettled] = useState(false)
  // A missing or broken still falls back to the initials rather than the
  // browser's broken-image glyph.
  const [posterFailed, setPosterFailed] = useState(false)

  // Rule 1 — the card has to be about half on screen before a decoder may be
  // requested. `inView` tracks the current crossing, so scrolling away mid-clip
  // unmounts the video and releases the permit instead of decoding off-screen.
  useEffect(() => {
    const node = cardRef.current
    if (!node || typeof IntersectionObserver !== 'function') return
    const observer = new IntersectionObserver(
      (entries) => {
        setInView(entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= TEAM_VIDEO_IN_VIEW_RATIO))
      },
      { threshold: TEAM_VIDEO_IN_VIEW_RATIO },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Rule 2 — asking is not enough; the shared permit has to be free.
  const wantsVideo = !reduceMotion && !settled && inView && Boolean(member.videoSrc)
  useEffect(() => {
    if (!wantsVideo) {
      setPermitted(false)
      return
    }
    const cancel = slot.request(token, (granted) => setPermitted(granted === token))
    return () => {
      cancel()
      setPermitted(false)
    }
  }, [wantsVideo, slot, token])

  // Rule 3 — after the crossfade the clip is done for this visit: unmounted,
  // decoder released, poster left behind.
  const handleSettled = useCallback(() => {
    setSettled(true)
    setPermitted(false)
  }, [])

  const showVideo = permitted && !settled && Boolean(member.videoSrc)

  return (
    <li ref={cardRef} className="team-card" data-team-card={member.id}>
      <div className="team-card__media" aria-hidden="true">
        {/* The initials sit underneath as the always-present fallback: they
            carry the card before the still loads, and stay if it 404s. */}
        <span className="team-card__poster">{member.initials}</span>
        {member.posterSrc && !posterFailed && (
          <img
            className="team-card__poster-image"
            src={member.posterSrc}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setPosterFailed(true)}
          />
        )}
        {showVideo && (
          <TeamVideo src={member.videoSrc!} poster={member.posterSrc} onSettled={handleSettled} />
        )}
      </div>
      <div className="team-card__body">
        <h3 className="team-card__name">{member.name}</h3>
        <p className="team-card__role">{member.role}</p>
      </div>
    </li>
  )
}

/**
 * One clip, one decoder, one play. Mounted only while its card holds the
 * shared permit, and unmounted by its parent once the closing crossfade ends.
 */
function TeamVideo({ src, poster, onSettled }: { src: string; poster?: string; onSettled: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [revealed, setRevealed] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const settled = useRef(false)

  const settle = useCallback((crossfadeOut: boolean) => {
    if (settled.current) return
    settled.current = true
    videoRef.current?.pause()
    if (crossfadeOut) {
      setLeaving(true)
      return
    }
    // Nothing was ever on screen, so there is nothing to fade: leave at once.
    onSettled()
  }, [onSettled])

  // The crossfade owns the unmount — the element stays in the DOM until the
  // poster has come back underneath it, then the parent removes it.
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(onSettled, TEAM_VIDEO_CROSSFADE_MS)
    return () => window.clearTimeout(timer)
  }, [leaving, onSettled])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let cancelled = false
    let watchdog = window.setTimeout(() => settle(false), TEAM_VIDEO_STALL_MS)
    const firstFrame = () => {
      if (cancelled || settled.current) return
      window.clearTimeout(watchdog)
      watchdog = window.setTimeout(() => settle(true), TEAM_VIDEO_MAX_MS)
      setRevealed(true)
    }
    video.addEventListener('loadeddata', firstFrame)
    if (video.readyState >= 2) firstFrame()
    void video.play()?.catch?.(() => { if (!cancelled) settle(false) })
    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
      video.removeEventListener('loadeddata', firstFrame)
      video.pause()
      // Dropping the source before React removes the node is what actually
      // frees the decoder; unmounting alone can leave it attached to the file.
      video.removeAttribute('src')
      video.load()
    }
  }, [settle])

  return (
    <video
      ref={videoRef}
      className={`team-card__video${leaving ? ' is-leaving' : revealed ? ' is-revealed' : ''}`}
      src={src}
      poster={poster}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      controls={false}
      controlsList="nodownload nofullscreen noremoteplayback"
      disablePictureInPicture
      disableRemotePlayback
      draggable={false}
      onEnded={() => settle(true)}
      onError={() => settle(false)}
    />
  )
}
