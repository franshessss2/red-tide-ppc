import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import type { PopupEvent } from 'leaflet'
import { cameraFor } from '../motion/camera'
import { useReducedMotion } from '../motion/preferences'

/** Leaflet does not consult the OS preference. Apply it to native inputs,
 * popup auto-pan, inertia and camera commands, including live changes. */
export function MapMotionPolicy() {
  const map = useMap()
  const reduce = useReducedMotion()
  useEffect(() => {
    // Leaflet checks this option before starting native zoom transitions.
    map.options.zoomAnimation = !reduce
    map.options.markerZoomAnimation = !reduce
    map.options.inertia = !reduce
    if (reduce) cameraFor(map).settle()
    const container = map.getContainer()
    const cancel = () => cameraFor(map).cancel()
    const key = (event: KeyboardEvent) => {
      if (event.target !== container) return
      cancel()
      const offsets: Record<string, [number, number]> = {
        ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80],
      }
      if (reduce && offsets[event.key]) {
        event.preventDefault()
        event.stopPropagation()
        const [x, y] = offsets[event.key]
        map.panBy([x * (event.shiftKey ? 3 : 1), y * (event.shiftKey ? 3 : 1)], { animate: false })
      }
    }
    const popup = ({ popup }: PopupEvent) => {
      if (!reduce) return
      const node = popup.getElement()
      if (!node) return
      const bounds = container.getBoundingClientRect()
      const box = node.getBoundingClientRect()
      const dx = box.right > bounds.right - 16 ? box.right - bounds.right + 16 : Math.min(0, box.left - bounds.left - 16)
      const dy = box.bottom > bounds.bottom - 16 ? box.bottom - bounds.bottom + 16 : Math.min(0, box.top - bounds.top - 16)
      if (dx || dy) { cancel(); map.panBy([dx, dy], { animate: false }) }
    }
    container.addEventListener('pointerdown', cancel, { passive: true })
    container.addEventListener('wheel', cancel, { passive: true })
    container.addEventListener('keydown', key, true)
    map.on('popupopen', popup)
    return () => {
      container.removeEventListener('pointerdown', cancel)
      container.removeEventListener('wheel', cancel)
      container.removeEventListener('keydown', key, true)
      map.off('popupopen', popup)
    }
  }, [map, reduce])
  useEffect(() => () => cameraFor(map).cancel(), [map])
  return null
}
