import { useCallback, useEffect, useRef, useState } from 'react'
import * as MapLibreGL from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { Map, MapControls } from '@/components/ui/map'

// Serve the matching worker with the app rather than depend on a second CDN.
// This configures MapLibre without altering the installed registry component.
MapLibreGL.setWorkerUrl(workerUrl)

export default function StreetMapExample() {
  const [failed, setFailed] = useState(false)
  const [tileWarning, setTileWarning] = useState(false)
  const cleanup = useRef<(() => void) | null>(null)
  const ready = useRef(false)
  const mapRef = useCallback((map: MapLibreGL.Map | null) => {
    cleanup.current?.()
    cleanup.current = null
    if (!map) return
    const loaded = () => { ready.current = true }
    const error = () => setTileWarning(true)
    map.on('load', loaded)
    map.on('error', error)
    if (map.loaded()) loaded()
    cleanup.current = () => { map.off('load', loaded); map.off('error', error) }
  }, [])
  useEffect(() => {
    const timeout = window.setTimeout(() => { if (!ready.current) setFailed(true) }, 30000)
    return () => { window.clearTimeout(timeout); cleanup.current?.() }
  }, [])
  if (failed) return <p role="status" className="p-6 text-muted">Street map could not load. Check your connection, then close and reopen this view. The coastal map is still available.</p>
  return <>
    {tileWarning && <p role="status" className="px-4 py-2 text-sm text-muted">Some street-map data could not download. Labels or tiles may be incomplete.</p>}
    <div className="street-map-example" aria-label="Puerto Princesa street map">
      <Map ref={mapRef} center={[118.7353, 9.7392]} zoom={11} theme="dark">
        <MapControls position="top-right" showCompass />
      </Map>
    </div>
  </>
}
