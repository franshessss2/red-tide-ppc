import { useEffect, useRef, useState, type ReactNode } from 'react'

export function MobileMapActions({
  children,
  onOpen,
  panelOpen = false,
}: {
  children: ReactNode
  onOpen?: () => void
  panelOpen?: boolean
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (panelOpen) setOpen(false)
  }, [panelOpen])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return (
    <div ref={root} className="mobile-map-actions relative md:hidden">
      <button
        ref={trigger}
        type="button"
        className="grid h-11 w-11 place-items-center rounded-md border border-line bg-ink-2 text-paper"
        aria-label="Map options"
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.()
          setOpen((value) => !value)
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {open && (
        <div
          className="mobile-map-actions__menu"
          aria-label="Map options"
          onClick={(event) => {
            if ((event.target as Element).closest('button,a')) {
              setOpen(false)
              if (!(event.target as Element).closest('a'))
                trigger.current?.focus()
            }
          }}
        >
          <p className="w-full text-xs text-muted">
            Street map · Shipping lanes · Reset view · Admin
          </p>
          {children}
        </div>
      )}
    </div>
  )
}
