import { Component, Suspense, lazy, useEffect, useRef, type ReactNode } from 'react'
import { TextReveal } from './TextReveal'
import '../styles/street-map.css'

const StreetMapExample = lazy(() => import('./StreetMapExample'))

class StreetMapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <p role="status" className="p-6 text-muted">Street map unavailable. Your browser may not support WebGL, or the map could not download. Close this view to continue using the coastal map.</p> : this.props.children
  }
}

/** Native top-layer modal: traps focus, makes the coastal map inert, restores
 * focus on dismissal. The underlying map and its selected zone stay mounted. */
export function StreetMapDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = dialog.current
    const previous = document.activeElement as HTMLElement | null
    node?.showModal()
    return () => {
      node?.close()
      if (previous?.isConnected) previous.focus()
      else document.querySelector<HTMLButtonElement>('button[aria-label="Map options"]')?.focus()
    }
  }, [])
  return <dialog ref={dialog} className="street-map-dialog" aria-labelledby="street-map-title"
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) {
      const box = event.currentTarget.getBoundingClientRect()
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
    } }}>
    <div className="flex items-start justify-between gap-4 border-b border-line p-4">
      <div><h2 id="street-map-title" className="text-lg font-semibold"><TextReveal text="Street map" trigger="mount" /></h2>
        <p className="mt-1 text-sm text-muted">Puerto Princesa · streets and place labels. Coastal records remain on the main map.</p></div>
      <button type="button" onClick={onClose} aria-label="Close street map" className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line text-xl hover:text-accent">×</button>
    </div>
    <StreetMapBoundary><Suspense fallback={<p role="status" className="p-6">Loading street map…</p>}><StreetMapExample /></Suspense></StreetMapBoundary>
  </dialog>
}
