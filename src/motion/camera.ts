import type { Map as LeafletMap } from 'leaflet'
import { createMotionScope } from './scope'

/** A map has one camera owner. Old cleanups cannot cancel a newer intent. */
const cameras = new WeakMap<LeafletMap, ReturnType<typeof createCamera>>()
function createCamera(map: LeafletMap) {
  let current: { scope: ReturnType<typeof createMotionScope>; settle: () => void } | null = null
  const cancel = () => {
    const previous = current
    current = null
    previous?.scope.dispose()
    if (map.getPane('mapPane')) map.stop()
  }
  return {
    cancel,
    settle() {
      const target = current?.settle
      cancel()
      target?.()
    },
    run(move: () => void, settle: () => void, animated: boolean, deferred = false) {
      cancel()
      const scope = createMotionScope()
      const owner = { scope, settle }
      current = owner
      const release = () => {
        if (current === owner) current = null
        scope.dispose()
      }
      const start = () => {
        move()
        if (!animated) release()
        else {
          map.once('moveend', release)
          scope.own(() => map.off('moveend', release))
        }
      }
      if (deferred) scope.frame(start)
      else start()
      return () => { if (current === owner) cancel() }
    },
  }
}
export function cameraFor(map: LeafletMap) {
  let camera = cameras.get(map)
  if (!camera) { camera = createCamera(map); cameras.set(map, camera) }
  return camera
}
