import { useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useReducedMotion } from '../motion/preferences'
import { ZoneStatusBadge } from './StatusBadge'
import { DataProvenance } from './DataProvenance'
import { formatRecordTime } from '../lib/format'
import { zoneGuidance } from '../styles/statusTheme'
import type { Zone } from '../types'

export function MapWorkspacePanel({ zones, ready, selected, pendingCounts, onSelect, onClose, onLocate, onReport, tileNotice }: {
  tileNotice?: ReactNode
  zones: Zone[]; ready: boolean; selected: Zone | null; pendingCounts: Record<string, number>
  onSelect: (id: string) => void; onClose: () => void; onLocate: () => void; onReport: (id: string) => void
}) {
  const reduce = useReducedMotion()
  const panelBody = useRef<HTMLDivElement>(null)
  const focusAfterPick = useRef(false)
  const choose = (id: string) => { focusAfterPick.current = true; onSelect(id) }
  useEffect(() => {
    if (panelBody.current) panelBody.current.scrollTop = 0
    if (!focusAfterPick.current) return
    focusAfterPick.current = false
    panelBody.current?.querySelector<HTMLElement>(selected ? 'h3' : '.map-zone-list button')?.focus({ preventScroll: true })
  }, [selected?.id])
  return <aside className="map-workspace-panel" aria-label="Coastal zones and details">
    <div className="map-panel-heading">
      <div><p className="map-kicker">COASTAL RECORDS</p><h2>{selected ? 'Zone details' : 'Explore the coast'}</h2></div>
      <button className="map-icon-button" aria-label="Close zone panel" onClick={onClose}>×</button>
    </div>
    <div ref={panelBody} className="map-panel-scroll">
      {tileNotice}
      {selected ? <motion.section key={selected.id} initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.18 }}>
        <button className="map-back" onClick={() => choose('')}>← All coastal zones</button>
        <h3 tabIndex={-1} className="map-zone-title">{selected.name}</h3>
        <ZoneStatusBadge status={selected.status} />
        <p className="map-panel-copy">{selected.description}</p>
        <p className="map-guidance">{zoneGuidance(selected.status)}</p>
        <dl className="map-record-meta"><dt>Status record</dt><dd>{formatRecordTime(selected.lastUpdated, selected.lastUpdatedPending)}</dd><dt>Pending reports</dt><dd>{pendingCounts[selected.id] ?? 0} pending {(pendingCounts[selected.id] ?? 0) === 1 ? 'report' : 'reports'}</dd></dl>
        <div className="map-panel-actions"><button className="map-primary" onClick={() => onReport(selected.id)}>Report an observation</button><button className="map-secondary" onClick={onLocate}>Locate on map</button></div>
      </motion.section> : <>
        <p className="map-panel-copy">Choose a zone here or select its boundary on the map.</p>
        {!ready ? <p className="map-panel-copy">Waiting for zone records. Connection details are below.</p> : zones.length === 0 ? <p className="map-panel-copy">No zone records available.</p> : <ul className="map-zone-list">{zones.map(zone => <li key={zone.id}>
          <button onClick={() => choose(zone.id)}><h3 className="map-zone-name">{zone.name}</h3><ZoneStatusBadge status={zone.status} size="sm" /><span className="map-zone-pending">{pendingCounts[zone.id] ?? 0} pending reports</span><span className="map-zone-chevron" aria-hidden="true">›</span></button>
        </li>)}</ul>}
      </>}
      <div className="map-panel-note">Approximate coastal boundaries. Report pins mark zone centres, not observation locations.</div>
      <div className="map-pin-key"><span><i className="map-pin-pending" />Pending report</span><span><i className="map-pin-reviewed" />Reviewed report</span></div>
      <details className="map-record-details"><summary>Data source and connection</summary><DataProvenance /></details>
    </div>
  </aside>
}
