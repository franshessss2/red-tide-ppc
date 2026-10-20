import { useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from '../motion/preferences'
import { useSaveData } from '../motion/LandingMotionPolicy'

const DOWNLOAD_FOLDER =
  'https://drive.google.com/drive/folders/1mpUalyCgYrDXoN8L1KP7WVv11_p-VFSJ?usp=sharing'

/** Landing-only download entry point; the QR image is fetched after opening. */
export function AndroidDownloadButton() {
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  const open = phase !== 'closed'
  const closing = phase === 'closing'
  const reducedMotion = useReducedMotion()
  const saveData = useSaveData()
  const motionDisabled = reducedMotion || saveData
  const button = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()

  function requestClose() {
    if (closing) return
    setPhase(motionDisabled ? 'closed' : 'closing')
  }

  // Keep the native modal and scroll lock until its 180ms exit finishes.
  // The fallback also releases them if a transition is cancelled or unsupported.
  useEffect(() => {
    if (!closing) return
    if (motionDisabled) { setPhase('closed'); return }
    const timer = window.setTimeout(() => setPhase('closed'), 260)
    return () => window.clearTimeout(timer)
  }, [closing, motionDisabled])

  // Desktop presents a scannable code immediately; phones lead with the link.
  useEffect(() => {
    if (!open) return
    const media = window.matchMedia?.('(min-width: 640px)')
    const qr = dialog.current?.querySelector('details')
    if (!media || !qr) return
    const update = () => { qr.open = media.matches }
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [open])

  useEffect(() => {
    if (!open) return
    const node = dialog.current
    if (!node) return
    const opener = button.current
    const overflow = document.body.style.overflow
    node.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      node.close()
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label="Android app download QR code"
        title="Android app download"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setPhase('open')}
        data-motion={motionDisabled ? 'static' : 'enabled'}
        className="android-download-trigger grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line bg-ink-2/85 text-muted transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true" className="font-mono text-[10px] font-semibold tracking-[0.05em]">QR</span>
      </button>
      {open && (
        <dialog
          ref={dialog}
          id={id}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
          data-closing={closing}
          data-motion={motionDisabled ? 'static' : 'enabled'}
          className="android-download-dialog m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-2xl border border-line bg-ink-2 p-0 text-paper shadow-2xl backdrop:bg-black/75"
          onCancel={(event) => { event.preventDefault(); requestClose() }}
          onTransitionEnd={(event) => {
            if (closing && event.target === event.currentTarget && event.propertyName === 'opacity') setPhase('closed')
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return
            const box = event.currentTarget.getBoundingClientRect()
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) requestClose()
          }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line p-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Android alpha</p>
              <h2 id={`${id}-title`} className="mt-1 text-lg font-semibold">Get Red Tide PPC</h2>
            </div>
            <button type="button" autoFocus onClick={requestClose} aria-label="Close Android download" className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line text-xl text-muted hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className="android-download-body flex flex-col p-5">
            <p id={`${id}-description`} className="text-sm text-muted">Open the download folder and choose the APK. To send it to another phone, scan the QR below.</p>
            <a href={DOWNLOAD_FOLDER} target="_blank" rel="noopener noreferrer" className="android-download-link mt-5 flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 text-sm font-semibold text-ink hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Open download folder <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <details className="android-download-qr mt-4">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm text-muted focus-visible:outline-2 focus-visible:outline-accent">Send to another phone <span aria-hidden="true">QR ＋</span></summary>
              <img src="/media/android/red-tide-download-qr.svg" width="900" height="900" alt="QR code for the Red Tide PPC Android download folder" className="mx-auto mt-3 aspect-square w-full max-w-[252px] rounded-lg bg-white" />
            </details>
            <p className="mt-4 text-xs leading-relaxed text-muted">Android testing build · Sample data. Installation is outside Google Play. Real-phone behavior is still unverified.</p>
          </div>
        </dialog>
      )}
    </>
  )
}
