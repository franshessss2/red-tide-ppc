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
    <nav ref={root} className="landing-nav" aria-label="Primary navigation" onBlur={event => {
      if (root.current?.closest('[inert]')) return
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
    }}>
      <Link to="/map" className="landing-nav__map" onPointerEnter={prefetchMapPage} onFocus={prefetchMapPage}>Map</Link>
      <AndroidDownloadButton />
      <button ref={trigger} type="button" className="landing-nav__toggle" aria-label="More options" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        More
        <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      <div id={id} className="landing-nav__panel" hidden={!open} inert={!open}>
        <p className="landing-nav__caption">Explore RTP</p>
        {/* Leave the disclosure open during replay so the intro can return focus here. */}
        {onReplay && <button type="button" data-intro-replay onClick={onReplay}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6" /></svg><span className="landing-nav__replay-label">Watch introduction</span></button>}
        <a href="/arduino.html" onClick={() => setOpen(false)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4" /></svg>Arduino diagnostics</a>
        <Link to="/admin" className="landing-nav__admin" onClick={() => setOpen(false)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></svg>Admin</Link>
      </div>
    </nav>
  )
}
