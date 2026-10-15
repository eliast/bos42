import { useEffect, useMemo, useRef, useState } from 'react';
import { routeFitsAircraft } from '../shared/aviation.mjs';
import { apiUrl } from './api';
import type { Vessel, HarborStatus } from './harborTypes';
import { vesselName, vesselIsStale, vesselAge } from './VesselInfo';
import type { Aircraft, FeedStatus, Route, RouteResult } from './types';

type BoardFilter = 'all' | 'arrivals' | 'climbing' | 'harbor';
interface Props {
  initialFilter?: BoardFilter;
  automatic?: boolean;
  onInteract?: () => void;
  aircraft: Aircraft[];
  vessels: Vessel[]; harborStatus: HarborStatus; harborEnabled: boolean; selectedVesselId: string | null; onSelectVessel: (id:string) => void;
  selectedId: string | null;
  selectedRoute: Route | null;
  status: FeedStatus;
  now: number;
  onClose: () => void;
  onSelect: (id: string) => void;
}
const routeCache = new Map<string, { route: Route | null; expires: number }>();
const routePending = new Map<string, Promise<Route | null>>();
const code = (airport: Route['origin']) => airport?.iata || airport?.icao || '—';
const rounded = (value: number) => Math.round(value).toLocaleString();

async function lookupRoute(callsign: string): Promise<Route | null> {
  const cached = routeCache.get(callsign);
  if (cached && cached.expires > Date.now()) return cached.route;
  if (cached) routeCache.delete(callsign);
  if (routePending.has(callsign)) return routePending.get(callsign)!;
  const pending = fetch(apiUrl(`/api/route/${encodeURIComponent(callsign)}`), { cache: 'no-store', signal: AbortSignal.timeout(15000) })
    .then(response => response.json() as Promise<RouteResult>)
    .then(result => {
      if (result.status === 'found' || result.status === 'unknown') routeCache.set(callsign, { route: result.route, expires: Date.now() + 3600000 });
      return result.route;
    })
    .catch(() => null)
    .finally(() => routePending.delete(callsign));
  routePending.set(callsign, pending);
  return pending;
}

export function TrafficBoard({ initialFilter='all',automatic=false,onInteract,vessels, harborStatus, harborEnabled, selectedVesselId, onSelectVessel, aircraft, selectedId, selectedRoute, status, now, onClose, onSelect }: Props) {
  const [filter, setFilter] = useState<BoardFilter>(initialFilter);
  const [query, setQuery] = useState('');
  const [searchEditing, setSearchEditing] = useState(false);
  const televisionApp = !!import.meta.env.VITE_TIZEN_APP;
  const activateSearch = (input: HTMLInputElement) => {
    if (!televisionApp || searchEditing) return;
    input.blur();
    setSearchEditing(true);
    requestAnimationFrame(() => input.focus());
  };
  const [routes, setRoutes] = useState<Record<string, Route | null>>({});
  const closeButton = useRef<HTMLButtonElement>(null);
  const rows = useMemo(() => aircraft.slice().sort((a, b) => a.distanceNm - b.distanceNm), [aircraft]);
  const counts = {
    all: rows.length, harbor: vessels.length,
    arrivals: rows.filter(a => a.phase === 'Likely arrival').length,
    climbing: rows.filter(a => a.phase === 'Climbing').length,
  };
  const visible = rows.filter(a => (filter === 'all' || (filter === 'arrivals' ? a.phase === 'Likely arrival' : a.phase === 'Climbing')) &&
    (!query || `${a.label} ${a.callsign} ${a.operator} ${a.registration || ''}`.toLowerCase().includes(query.trim().toLowerCase())));

  const vesselRows = vessels.filter(v => !query || `${vesselName(v)} ${v.mmsi} ${v.label} ${v.destination || ''}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => (b.speedKts ?? 0) - (a.speedKts ?? 0));
  useEffect(() => {
    if(automatic)return;
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => { previous?.focus(); };
  }, []);

  useEffect(() => {
    if (status === 'demo' || filter === 'harbor') return;
    let active = true;
    // The route service permits three simultaneous lookups. Two workers leave
    // capacity for the selected flight's detail lookup in App.
    const callsigns = [...new Set(rows.map(a => a.callsign).filter(Boolean))];
    let next = 0;
    async function worker() {
      while (active && next < callsigns.length) {
        const callsign = callsigns[next++];
        const route = await lookupRoute(callsign);
        if (active) setRoutes(previous => ({ ...previous, [callsign]: route }));
      }
    }
    void worker(); void worker();
    return () => { active = false; };
  }, [filter, status === 'demo', rows.map(a => a.callsign).join('|')]);

  const feedLabel = status === 'live' ? 'LIVE POSITIONS' : status === 'demo' ? 'SIMULATED POSITIONS' : status === 'stale' ? 'POSITIONS STALE' : status === 'connecting' ? 'CONNECTING' : 'FEED OFFLINE';
  return <section className="traffic-board" role="dialog" aria-modal="false" aria-labelledby="traffic-board-title" onPointerDownCapture={onInteract} onKeyDownCapture={onInteract}>
    <header className="board-header">
      <div className="board-brand"><span className="board-brand-mark">BOS<span>/</span>42</span><span className="board-brand-copy">BOSTON LOGAN<br/>AIRSPACE BOARD</span></div>
      <div className="board-title"><small>{filter === 'harbor' ? `BOSTON HARBOR / ${harborEnabled ? harborStatus.toUpperCase() : 'LAYER OFF'}` : `NEARBY AIRCRAFT / ${feedLabel}`}</small><h2 id="traffic-board-title">Traffic board</h2></div>
      <button ref={closeButton} className="board-return" onClick={onClose} aria-label="Return to map"><span aria-hidden="true">↖</span> Return to map</button>
    </header>
    <div className="board-toolbar">
      <div className="board-tabs" role="group" aria-label="Traffic filter">
        {([['all', 'Aircraft'], ['arrivals', 'Arrivals'], ['climbing', 'Climbing'], ['harbor', 'Harbor']] as const).map(([value, label]) =>
          <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<b>{counts[value]}</b></button>)}
      </div>
      <label className="board-search"><span className="sr-only">Find flight or vessel</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 5 5"/></svg><input value={query} readOnly={televisionApp && !searchEditing} data-tv-editing={searchEditing || undefined} onClick={event => activateSearch(event.currentTarget)} onKeyDown={event => {if (televisionApp && event.key === 'Enter' && !searchEditing) {event.preventDefault();activateSearch(event.currentTarget);}}} onBlur={() => setSearchEditing(false)} onChange={event => setQuery(event.target.value)} placeholder={televisionApp && !searchEditing ? 'Press OK to search' : filter === 'harbor' ? 'Find vessel' : 'Find flight or airline'} /></label>
    </div>
    {filter === 'harbor' ? <div className="board-list harbor-board" role="list" aria-label="Harbor vessels">
      <div className="board-columns" aria-hidden="true"><span>VESSEL / TYPE</span><span>REPORTED DESTINATION</span><span>LENGTH</span><span>SPEED</span><span>AIS STATUS</span></div>
      {vesselRows.map(v => <div role="listitem" className="board-listitem" key={v.id}><button className={`board-row ${v.id === selectedVesselId ? 'is-selected' : ''}`} onClick={() => onSelectVessel(v.id)} style={{'--plane-color':v.color} as React.CSSProperties} aria-label={`Follow ${vesselName(v)}`}>
        <span className="board-flight"><i className="board-color"/><span className="board-flight-text"><strong>{vesselName(v)}</strong><small>{v.label}</small></span></span>
        <span className="board-route"><strong>{v.destination || '—'}</strong><small>{v.destination ? 'Crew-entered' : 'Not reported'}</small></span>
        <span className="board-measure"><strong>{v.lengthM ?? '—'}</strong><small>METERS</small></span>
        <span className="board-measure"><strong>{v.speedKts === null ? '—' : v.speedKts.toFixed(1)}</strong><small>KTS</small></span>
        <span className="board-phase"><strong>{harborStatus !== 'live' || vesselIsStale(v,now) ? 'Last position' : v.navigationLabel || 'Position received'}</strong><small>{vesselAge(v,now) < 60 ? `${vesselAge(v,now)}s` : `${Math.floor(vesselAge(v,now)/60)}m`} ago</small></span>
      </button></div>)}
      {!vesselRows.length && <div className="board-empty">{!harborEnabled ? 'Enable Harbor vessels in Settings to see boats.' : query ? 'No vessels match that search.' : harborStatus === 'live' || harborStatus === 'connecting' ? 'Listening for Boston Harbor AIS positions…' : 'Harbor feed unavailable. Reconnecting automatically.'}</div>}
    </div> : <div className="board-list" role="list" aria-label="Nearby traffic">
      <div className="board-columns" aria-hidden="true"><span>FLIGHT / OPERATOR</span><span>PUBLISHED ROUTE</span><span>ALTITUDE</span><span>SPEED</span><span>STATUS</span></div>
      {visible.map(a => {
        const candidate = selectedRoute?.callsign === a.callsign ? selectedRoute : routes[a.callsign];
        const route = routeFitsAircraft(candidate, a) ? candidate : null;
        const age = Math.max(0, (now - a.observedAt) / 1000);
        const phase = age > 20 ? 'Position old' : a.ground ? 'On ground' : a.phase === 'Likely arrival' ? 'Likely arrival' : a.phase;
        return <div role="listitem" className="board-listitem" key={a.id}><button className={`board-row ${a.id === selectedId ? 'is-selected' : ''}`} onClick={() => onSelect(a.id)} style={{ '--plane-color': a.color } as React.CSSProperties} aria-label={`Watch ${a.label}, ${a.operator}, ${phase}`}>
          <span className="board-flight"><i className="board-color"/><span className="board-flight-text"><strong>{a.label}</strong><small>{a.operator}</small></span></span>
          <span className="board-route">{route ? <><strong>{code(route.origin)} <em>→</em> {code(route.destination)}</strong><small>Published route</small></> : <><strong className="board-unavailable">—</strong><small>{status === 'demo' ? 'Sample flight' : 'Route unavailable'}</small></>}</span>
          <span className="board-measure"><strong>{a.ground ? 'GROUND' : rounded(a.altitudeFt)}</strong><small>{a.ground ? 'Surface' : `FT · ${a.altitudeSource === 'barometric' ? 'BARO' : 'MSL'}`}</small></span>
          <span className="board-measure"><strong>{a.ground && a.speedKts < 1 ? '—' : rounded(a.speedKts)}</strong><small>KTS</small></span>
          <span className="board-phase"><strong>{phase}</strong><small>{a.distanceNm.toFixed(1)} NM from BOS</small></span>
        </button></div>;
      })}
      {!visible.length && <div className="board-empty">{status === 'connecting' ? 'Connecting to the aircraft feed…' : query ? 'No flights match that search.' : 'No aircraft in this view.'}</div>}
    </div>}
    <footer className="board-footer"><span>{filter === 'harbor' ? `${vesselRows.length} OF ${vessels.length} VESSELS` : `${visible.length} OF ${rows.length} AIRCRAFT IN VIEW`}</span><span>{filter === 'harbor' ? 'AISSTREAM · COVERAGE VARIES · DESTINATIONS AND DIMENSIONS ARE REPORTED BY VESSELS' : 'ARRIVAL IS INFERRED FROM MOTION · ROUTES ARE PUBLISHED, NOT LIVE SCHEDULES'}</span></footer>
  </section>;
}
