import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AndroidDownloadButton } from './AndroidDownloadButton'
import { prefetchMapPage } from '../App'

/** One navigation layout across breakpoints; secondary actions stay out of the brand row. */
export function LandingNavigation({ onReplay }: { onReplay?: () => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (root.current?.closest('[inert]')) return
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (root.current?.closest('[inert]')) return
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return (
    <nav ref={root} className="landing-nav" aria-label="Primary navigation">
      <AndroidDownloadButton />
      <Link to="/map" className="landing-nav__map" onPointerEnter={prefetchMapPage} onFocus={prefetchMapPage}>Map <span aria-hidden="true">↗</span></Link>
      <button ref={trigger} type="button" className="landing-nav__toggle" aria-label="More options" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={open ? 'm6 6 12 12M6 18 18 6' : 'M4 7h16M4 12h16M4 17h16'} /></svg>
      </button>
      <div id={id} className="landing-nav__panel" data-open={open} onBlur={event => {
        if (root.current?.closest('[inert]')) return
        if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}>
        <p className="landing-nav__caption px-3 pb-2 font-mono text-[10px] uppercase tracking-widest text-faint">Explore RTP</p>
        {/* Keep the replay control visible for the intro's existing focus-return contract. */}
        {onReplay && <button type="button" data-intro-replay onClick={onReplay}><span aria-hidden="true">↻</span> Watch introduction</button>}
        <a href="/arduino.html" onClick={() => setOpen(false)}><span aria-hidden="true">⌁</span> Arduino diagnostics</a>
        <Link to="/admin" onClick={() => setOpen(false)}><span aria-hidden="true">◇</span> Admin</Link>
      </div>
    </nav>
  )
}
