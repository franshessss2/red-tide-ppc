import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Map as LeafletMap } from 'leaflet'
import { LiveDataStatus } from '../components/LiveDataStatus'
import { MapFeedStatus } from '../components/DataProvenance'
import { Header } from '../components/Header'
import { Map } from '../components/Map'
import { ZoomControls } from '../components/MapControlColumn'
import { MapWorkspacePanel } from '../components/MapWorkspacePanel'
import { ZoneStatusIcon } from '../components/ZoneStatusIcon'
import { Notice } from '../components/Notice'
import { ReportForm } from '../components/ReportForm'
import { usePresenceProgress } from '../motion/usePresenceProgress'
import { selectPendingCountByZone, selectZoneById, useAppStore } from '../store'
import { reportSuccessMessage } from '../lib/reportFeedback'
import { zoneLabel } from '../styles/statusTheme'
import type { Zone, ZoneStatus } from '../types'
import '../styles/map-workspace.css'

/** One persistent map, a readable desktop panel and a compact mobile sheet. */
export function MapPage() {
  const zones = useAppStore(state => state.zones)
  const reports = useAppStore(state => state.reports)
  const zonesReady = useAppStore(state => state.zonesReady)
  const sample = useAppStore(state => state.backendKind === 'demo')
  const selectedZoneId = useAppStore(state => state.selectedZoneId)
  const reportZoneId = useAppStore(state => state.reportZoneId)
  const selectZone = useAppStore(state => state.selectZone)
  const openReportForm = useAppStore(state => state.openReportForm)
  const closeReportForm = useAppStore(state => state.closeReportForm)
  const [panelOpen, setPanelOpen] = useState(() => typeof matchMedia === 'function' && matchMedia('(min-width: 768px)').matches)
  const zonesToggle = useRef<HTMLButtonElement>(null)
  const [resetToken, setResetToken] = useState(0)
  const [focusToken, setFocusToken] = useState(0)
  const [leafletMap, setLeafletMap] = useState<LeafletMap | null>(null)
  const [shipping, setShipping] = useState(false)
  const [tileStatus, setTileStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [tileRetry, setTileRetry] = useState(0)
  const [slowTiles, setSlowTiles] = useState(false)
  const { mounted: shippingMounted, progress: shippingOpacity } = usePresenceProgress(shipping)
  const pendingCounts = useMemo(() => selectPendingCountByZone(reports), [reports])
  const counts = useMemo(() => {
    const result: Record<ZoneStatus, number> = { safe: 0, unconfirmed: 0, advisory: 0, unknown: 0 }
    for (const zone of zones) result[zone.status]++
    return result
  }, [zones])
  const selected = selectZoneById(zones, selectedZoneId)
  const reportZone = selectZoneById(zones, reportZoneId)
  const [heldZone, setHeldZone] = useState<Zone | null>(null)
  useEffect(() => { if (reportZone) setHeldZone(reportZone) }, [reportZone])
  useEffect(() => {
    setSlowTiles(false)
    if (tileStatus !== 'loading') return
    const timer = setTimeout(() => setSlowTiles(true), 5000)
    return () => clearTimeout(timer)
  }, [tileStatus, tileRetry])

  function chooseZone(id: string) { selectZone(id || null); setPanelOpen(true) }
  function clearSelection() { selectZone(null) }
  function closePanel() { clearSelection(); setPanelOpen(false); zonesToggle.current?.focus({ preventScroll: true }) }
  function resetView() { clearSelection(); setResetToken(token => token + 1) }
  function locate() {
    // Keep the focused polygon unobscured on small screens; details can be
    // reopened with the zones control without another camera flight.
    if (typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches) setPanelOpen(false)
    setFocusToken(token => token + 1)
  }

  const tileNotice = tileStatus === 'error' || slowTiles ? <div className="map-tile-notice" role="status"><span>{tileStatus === 'error' ? 'Some map tiles could not load. Zone records remain available.' : 'Map tiles are taking longer to load.'}</span>{tileStatus === 'error' && <button onClick={() => { setTileStatus('loading'); setTileRetry(value => value + 1) }}>Retry map tiles</button>}</div> : null

  return <div className={`map-workspace${panelOpen ? ' map-workspace--panel' : ''}`}>
    <LiveDataStatus />
    <div className="map-workspace-canvas">
      <Map zones={zones} reports={reports} selectedZoneId={selectedZoneId}
        resetToken={resetToken} focusZoneId={selectedZoneId} focusToken={focusToken}
        focusReserveRight={panelOpen ? 380 : 64} shippingLanesVisible={shippingMounted} shippingOpacity={shippingOpacity}
        onMapReady={setLeafletMap} onSelectZone={chooseZone} onClearSelection={clearSelection}
        onTileStatus={setTileStatus} tileRetry={tileRetry} />
    </div>
    <Header containerClassName="max-w-none px-4 sm:px-6" eyebrow="Puerto Princesa, Palawan" title="Red Tide" right={<>
      <Link className="map-header-link" to="/">Home</Link><Link className="map-header-link" to="/admin">Admin</Link>
    </>} />
    <div className="map-status-strip" aria-label="Community zone status summary">
      <span className="map-source-tag">{sample ? 'Sample data' : 'Community records'}</span>
      {(['advisory', 'unconfirmed', 'unknown', 'safe'] as const).map(status => <span key={status} className="map-status-item"><ZoneStatusIcon status={status} /><span>{zoneLabel(status)}</span><strong>{zonesReady ? counts[status] : '—'}</strong></span>)}
    </div>
    <div className="map-toolbar" aria-label="Map controls">
      <button ref={zonesToggle} className="map-tool map-zones-toggle" aria-expanded={panelOpen} aria-controls="coastal-panel" onClick={() => panelOpen ? closePanel() : setPanelOpen(true)}>Coastal zones <span aria-hidden="true">{panelOpen ? '−' : '+'}</span></button>
      <div className="map-tool-group"><ZoomControls map={leafletMap} /><button className="map-icon-button" aria-label="Reset view" title="Reset view" onClick={resetView}>⌖</button><button className="map-icon-button" aria-label="Show shipping lanes" title="Shipping lanes" aria-pressed={shipping} onClick={() => setShipping(value => !value)}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m5 14 1-6h12l1 6M12 8V4M3 17c2-2 4 2 6 0s4 2 6 0 4 2 6 0" /></svg></button></div>
    </div>
    {panelOpen && <div id="coastal-panel"><MapWorkspacePanel zones={zones} ready={zonesReady} selected={selected} pendingCounts={pendingCounts} onSelect={chooseZone} onClose={closePanel} onLocate={locate} onReport={openReportForm} tileNotice={tileNotice} /></div>}
    {!panelOpen && tileNotice}
    <div className="map-feed"><MapFeedStatus /></div>
    <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" data-testid="map-attribution" className="map-attribution">© OpenStreetMap contributors</a>
    {heldZone && <ReportForm key={heldZone.id} zone={heldZone} open={Boolean(reportZone)} onClose={closeReportForm}
      onDismissed={() => { if (useAppStore.getState().reportZoneId === null) setHeldZone(null) }} />}
    <Notice suppressNotice={heldZone ? reportSuccessMessage(heldZone.name) : undefined} />
  </div>
}
