import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Focus, inert background and scroll locking share the modal's lifetime. */
export function useModalFocus(ref: RefObject<HTMLElement | null>, onEscape: () => void) {
  const opener = useRef(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null)
  const escape = useRef(onEscape)
  escape.current = onEscape
  useLayoutEffect(() => {
    const panel = ref.current
    if (!panel) return
    const overflow = document.body.style.overflow
    const siblings = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && !node.contains(panel) && !['SCRIPT', 'STYLE'].includes(node.tagName))
    const previous = siblings.map(node => node.inert)
    siblings.forEach(node => { node.inert = true })
    document.body.style.overflow = 'hidden'
    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(node => !node.closest('[inert],[aria-hidden="true"]'))
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); escape.current(); return }
      if (event.key !== 'Tab') return
      const nodes = focusables()
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (!first) { event.preventDefault(); panel.focus(); return }
      if (!panel.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    const focus = () => { if (!panel.contains(document.activeElement)) (focusables()[0] ?? panel).focus() }
    document.addEventListener('keydown', key, true)
    document.addEventListener('focusin', focus)
    focus()
    return () => {
      document.removeEventListener('keydown', key, true)
      document.removeEventListener('focusin', focus)
      siblings.forEach((node, index) => { node.inert = previous[index] })
      document.body.style.overflow = overflow
      if (opener.current?.isConnected && !opener.current.closest('[inert]')) opener.current.focus()
    }
  }, [ref])
}
