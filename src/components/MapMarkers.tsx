import { useEffect, useMemo, useRef, useState } from 'react'
import { divIcon } from 'leaflet'
import type { DivIcon } from 'leaflet'
import { Marker, Popup, useMap } from 'react-leaflet'
import { polygonCentroid, INTRO_GLIDE_SECONDS, INTRO_GLIDE_SESSION_KEY, INTRO_GLIDE_WIDE_ZOOM } from '../motion/pins'
import { MAP_CENTER, MAP_DEFAULT_ZOOM } from '../data/zones'
import { formatRecordTime } from '../lib/format'
import { CommunitySource } from './DataProvenance'
import { ZoneStatusBadge } from './StatusBadge'
import { useSaveData } from '../motion/LandingMotionPolicy'
import type { Report, Zone } from '../types'
import { cameraFor } from '../motion/camera'
import { prefersReducedMotion, useReducedMotion } from '../motion/preferences'
import { createMotionScope } from '../motion/scope'

/**
 * Zone report badges at computed centroids, the user-location
 * dot, and the once-per-session intro glide.
 *
 * Everything here degrades to "simply not there" when its input is missing:
 * no geolocation permission → no dot; a session that already saw the glide
 * → a normal load; reduced motion → no glide or badge arrival animation.
 */

const REPORT_LABELS: Record<Report['status'], string> = {
  pending: 'Awaiting review',
  confirmed: 'Reviewed · confirmed',
  rejected: 'Reviewed · rejected',
}

/**
 * One accessible report badge per zone, anchored at its computed centroid.
 * The popup explicitly describes this as an approximate zone-level location.
 * Report review and zone advisory status remain separate, read-only concepts.
 * Only new arrivals animate; cached icons prevent replay on unrelated updates.
 */
export function ReportPins({ reports, zones, showReviewedReports = false }: {
  reports: Report[]; zones: Zone[]; showReviewedReports?: boolean
}) {
  const reduce = useReducedMotion()
  const saveData = useSaveData()
  const staticMotion = reduce || saveData
  const groups = useMemo(() => {
    const byZone = new Map<string, Report[]>()
    for (const report of reports) {
      if (!showReviewedReports && report.status !== 'pending') continue
      const group = byZone.get(report.zoneId) ?? []
      group.push(report)
      byZone.set(report.zoneId, group)
    }
    return zones.flatMap(zone => {
      const records = byZone.get(zone.id)
      if (!records?.length) return []
      return [{ zone, records: records.sort((a, b) =>
        Number(b.status === 'pending') - Number(a.status === 'pending') ||
        (b.submittedAt ?? 0) - (a.submittedAt ?? 0) || a.id.localeCompare(b.id)),
        pending: records.filter(report => report.status === 'pending').length,
        at: polygonCentroid(zone.polygon) }]
    })
  }, [reports, zones, showReviewedReports])

  // The id set as of first mount — everything in it is "pre-existing".
  const knownAtMount = useRef<Set<string> | null>(null)
  if (knownAtMount.current === null) {
    knownAtMount.current = new Set(reports.map((report) => report.id))
  }

  const iconCache = useRef<Map<string, { signature: string; icon: DivIcon }>>(new Map())
  const icons = useMemo(() => {
    const present = new Set(groups.map(group => group.zone.id))
    for (const id of iconCache.current.keys()) if (!present.has(id)) iconCache.current.delete(id)
    for (const group of groups) {
      const { zone, records, pending } = group
      const signature = JSON.stringify([records.map(record => record.id), pending, staticMotion])
      const cached = iconCache.current.get(zone.id)
      if (cached?.signature === signature) continue
      const fresh = !staticMotion && records.some(record => record.status === 'pending' && !knownAtMount.current?.has(record.id))
      records.forEach(record => knownAtMount.current?.add(record.id))
      iconCache.current.set(
        zone.id,
        { signature, icon: divIcon({
          className: 'report-badge-wrap',
          iconSize: [144, 44],
          iconAnchor: [72, 50],
          popupAnchor: [0, -48],
          html:
            `<span class="report-badge${pending ? ' report-badge--pending' : ''}${fresh ? ' report-badge--fresh' : ''}">` +
            '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 3h7l4 4v14H6V3Z M14 3v5h4 M9 12h6 M9 16h4"/></svg>' +
            `<span class="report-badge__copy"><strong>${records.length} ${records.length === 1 ? 'report' : 'reports'}</strong>` +
            `<span>${pending ? `${pending} awaiting review` : 'Reviewed records'}</span></span></span>`,
        }) },
      )
    }
    // Revealing history is not a new arrival, including records received
    // while the reviewed layer was hidden.
    reports.forEach(record => knownAtMount.current?.add(record.id))
    return iconCache.current
  }, [groups, staticMotion, reports])

  return (
    <>
      {groups.map(({ zone, records, pending, at }) => {
        const icon = icons.get(zone.id)?.icon
        if (!icon) return null
        const label = `${zone.name}: ${records.length} community ${records.length === 1 ? 'report' : 'reports'}, ${pending} awaiting review. Zone-level location.`
        return (
          <Marker
            key={zone.id}
            position={at}
            icon={icon}
            title={label}
            alt={label}
            ref={marker => { marker?.getElement()?.setAttribute('aria-label', label) }}
            keyboard
            eventHandlers={{
              add: event => { event.target.getElement()?.setAttribute('aria-label', label) },
              keypress: event => {
                if (event.originalEvent.key === ' ') {
                  event.originalEvent.preventDefault()
                  event.target.openPopup()
                }
              },
            }}
            zIndexOffset={200}
          >
            <Popup className="zone-popup report-popup" maxWidth={320}
              autoPanPaddingTopLeft={[16, 190]} autoPanPaddingBottomRight={[16, 150]}>
              <div className="report-popup__body">
                <span className="report-popup__eyebrow">Community reports</span>
                <h3>{zone.name}</h3>
                <p className="report-popup__location">Zone-level report · location approximate</p>
                <div className="report-popup__summary">
                  <span>{pending ? `${pending} awaiting review` : 'Review complete'}</span>
                  <ZoneStatusBadge status={zone.status} size="sm" />
                </div>
                <p className="report-popup__guidance">Reports do not automatically change the zone status.</p>
                <ol className="report-popup__records" aria-label={`Reports for ${zone.name}`}>
                  {records.map(record => <li key={record.id}>
                    <span className={`report-popup__status${record.status === 'pending' ? ' report-popup__status--pending' : ''}`}>{REPORT_LABELS[record.status]}</span>
                    <p className="report-popup__description">{record.description}</p>
                    <span className="report-popup__time">{formatRecordTime(record.submittedAt, record.submittedAtPending)}</span>
                    {record.photoUrl && <img src={record.photoUrl} alt="Community report attachment" loading="lazy" referrerPolicy="no-referrer" />}
                  </li>)}
                </ol>
                <CommunitySource />
                <p className="report-popup__clearance">Community records, not an official clearance.</p>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}

/**
 * The user's position, when — and only when — the browser hands one over.
 * `watchPosition` keeps the dot honest while the person moves; a denied or
 * missing geolocation simply leaves `pos` null and says nothing (no console
 * noise, which matters in the headless pass).
 */
export function UserLocationDot() {
  const [pos, setPos] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return
    const scope = createMotionScope()
    let watchId: number | null = null
    try {
      watchId = navigator.geolocation.watchPosition(
        scope.guard((position: GeolocationPosition) => setPos([position.coords.latitude, position.coords.longitude])),
        () => {
          /* denied / unavailable: no dot, no error surface */
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 },
      )
    } catch {
      /* geolocation threw synchronously: same outcome as denied */
    }
    return () => {
      scope.dispose()
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId)
        } catch {
          /* already gone */
        }
      }
    }
  }, [])

  const icon = useMemo(
    () =>
      divIcon({
        className: 'loc-wrap',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        html: '<span class="loc-dot"><span class="loc-halo" aria-hidden="true"></span></span>',
      }),
    [],
  )

  if (!pos) return null
  return <Marker position={pos} icon={icon} interactive={false} keyboard={false} zIndexOffset={400} />
}

/**
 * Once per browser session, the camera opens wide on Palawan and glides
 * into the Puerto Princesa bay default view. The sessionStorage flag is set
 * BEFORE the glide starts, so a reload mid-glide never replays it. Reduced
 * motion skips the whole thing — the map just loads at its normal view.
 */
export function IntroGlide() {
  const map = useMap()
  useEffect(() => {
    if (prefersReducedMotion()) return
    try { if (sessionStorage.getItem(INTRO_GLIDE_SESSION_KEY) === 'done') return }
    catch { return }
    const settle = () => map.setView(MAP_CENTER, MAP_DEFAULT_ZOOM, { animate: false })
    // Defer the entire operation. StrictMode may cancel setup before the
    // first frame; it must not leave a wide camera with an already-seen flag.
    return cameraFor(map).run(() => {
      try { sessionStorage.setItem(INTRO_GLIDE_SESSION_KEY, 'done') } catch { /* optional */ }
      map.setView(MAP_CENTER, INTRO_GLIDE_WIDE_ZOOM, { animate: false })
      map.flyTo(MAP_CENTER, MAP_DEFAULT_ZOOM, { animate: true, duration: INTRO_GLIDE_SECONDS })
    }, settle, true, true)
  }, [map])
  return null
}
