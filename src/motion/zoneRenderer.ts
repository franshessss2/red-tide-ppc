import { SVG, type LeafletEventHandlerFn, type RendererOptions } from 'leaflet'

/** Leaflet 1.9.4 normally reprojects SVG paths at zoomend and clips them at
 * moveend. A flyTo can cross multiple viewports before either event, leaving
 * destination zones empty or cut to the previous view. Keep only our two
 * small zone renderers current on move; do not reset the map or its tiles.
 * Native CSS zoom is disabled by MapMotionPolicy, so each flyTo frame has a
 * settled center/zoom that the renderer can project immediately.
 */
class MovingZoneSVG extends SVG {
  declare private _reset: () => void

  override getEvents(): Record<string, LeafletEventHandlerFn> {
    return { ...super.getEvents?.(), move: this.refreshGeometry }
  }

  private refreshGeometry() {
    // Localized Leaflet 1.9.4 renderer hook: updates the SVG bounds/transform
    // and reprojects every owned path together, including offscreen arrivals.
    // redrawing paths alone would retain the old renderer clip bounds.
    this._reset()
  }
}

export function createZoneRenderer(options: RendererOptions = {}): SVG {
  return new MovingZoneSVG({ padding: 0.1, ...options })
}
