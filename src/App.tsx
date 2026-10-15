import { useEffect, useMemo, useRef, useState } from 'react';
import { MapView, type MapHandle, type ScenicView } from './MapView';
import { MapBoundary } from './MapBoundary';
import { FlightGauges, VesselGauges } from './FlightGauges';
import { FlightTicker, FlightBadge } from './FlightTicker';
import { WeatherIcon } from './WeatherOverlay';
import { FollowFacts } from './FollowFacts';
import { resolveAircraftProfile } from '../shared/aircraftProfiles.mjs';
import { AircraftInfo } from './AircraftInfo';
import { FlightTimeline } from './FlightTimeline';
import { Spotter, enableSpotterSound } from './Spotter';
import { AtcRadio, RadioIcon } from './AtcRadio';
import { TrafficBoard } from './TrafficBoard';
import { arrivalQueue, directorScene } from '../shared/observation.mjs';
import {approachViews,type ApproachView} from '../shared/approaches.mjs';
import {useApproaches} from './useApproaches';
import {ApproachViews} from './ApproachViews';
import { CoastalWeather } from './CoastalWeather';
import { FullscreenButton } from './FullscreenButton';
import './TrafficBoard.css';
import { useAircraft, useRoute } from './useAircraft';
import { useHarbor } from './useHarbor';
import { VesselCard, VesselTicker } from './VesselInfo';
import { loadPreferences, savePreferences, DEFAULT_PREFERENCES } from './config';
import { routeFitsAircraft } from '../shared/aviation.mjs';
import { automaticSelection, nextLikelyArrival, watchFlight } from '../shared/selection.mjs';
import type { Aircraft, CameraMode } from './types';

const aircraftNames: Record<string, string> = { B763: 'Boeing 767-300', C68A: 'Cessna Citation Latitude', GLF6: 'Gulfstream G650', CL35: 'Bombardier Challenger 350', A319: 'Airbus A319', A320: 'Airbus A320', A321: 'Airbus A321', A20N: 'Airbus A320neo', A21N: 'Airbus A321neo', BCS1: 'Airbus A220-100', BCS3: 'Airbus A220-300', B738: 'Boeing 737-800', B739: 'Boeing 737-900', B38M: 'Boeing 737 MAX 8', B39M: 'Boeing 737 MAX 9', B772: 'Boeing 777-200', B77W: 'Boeing 777-300ER', B788: 'Boeing 787-8', B789: 'Boeing 787-9', B78X: 'Boeing 787-10', A332: 'Airbus A330-200', A333: 'Airbus A330-300', A339: 'Airbus A330neo', A359: 'Airbus A350-900', A35K: 'Airbus A350-1000', A388: 'Airbus A380', E75L: 'Embraer E175', E75S: 'Embraer E175', E190: 'Embraer E190', E170: 'Embraer E170', C402: 'Cessna 402', C172: 'Cessna 172', C208: 'Cessna Caravan', PC12: 'Pilatus PC-12', SF34: 'Saab 340', CRJ9: 'Bombardier CRJ900', CRJ7: 'Bombardier CRJ700' };
function typeName(a: Aircraft) { return resolveAircraftProfile(a.aircraftType)?.name || (a.aircraftType ? aircraftNames[a.aircraftType] || a.aircraftType : 'Aircraft type unavailable'); }
function contrast(color: string) { const hex = color.replace('#', ''); const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16); return (r * .299 + g * .587 + b * .114) > 150 ? '#07151c' : '#ffffff'; }

function ControlIcon({name}: {name: 'window' | 'explore' | 'follow' | 'traffic' | 'settings'}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'window' ? <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 13h18M4 16l4-2 4 1 5-4 3 2"/></> : name === 'explore' ? <><circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/></> : name === 'follow' ? <><path d="m12 3 2 7 7 4v2l-7-2v4l2 2v1l-4-1-4 1v-1l2-2v-4l-7 2v-2l7-4 2-7Z"/></> : name === 'traffic' ? <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r=".8"/><circle cx="3" cy="12" r=".8"/><circle cx="3" cy="18" r=".8"/></> : <><path d="m9.5 3-.6 2.2-1.6.9-2.2-.6-2.5 4.3 1.6 1.6v1.8l-1.6 1.6 2.5 4.3 2.2-.6 1.6.9.6 2.2h5l.6-2.2 1.6-.9 2.2.6 2.5-4.3-1.6-1.6v-1.8l1.6-1.6-2.5-4.3-2.2.6-1.6-.9-.6-2.2z"/><circle cx="12" cy="12" r="3"/></>}</svg>;
}

export default function App() {
  const [director, setDirector] = useState(true);
  const [directorBoard,setDirectorBoard]=useState<'arrivals'|'harbor'|null>(null);
  useEffect(() => {
    document.dispatchEvent(new CustomEvent('bos42:director-state',{detail:director}));
    const stop = () => setDirector(false);
    document.addEventListener('bos42:director-stop',stop);
    return () => document.removeEventListener('bos42:director-stop',stop);
  },[director]);
  const directorAdvancedAt = useRef(0);
  const directorStep = useRef(6), directorSeen = useRef(new Map<string,number>());
  const [remoteMapControls, setRemoteMapControls] = useState(false);
  const [scenicView, setScenicView] = useState<ScenicView | null>('Apartment');
  const [approachView,setApproachView]=useState<ApproachView|null>(null);
  const [remoteMapRotate, setRemoteMapRotate] = useState(false);
  useEffect(() => {
    document.dispatchEvent(new CustomEvent('bos42:map-controls', {detail:{active:remoteMapControls,rotate:remoteMapRotate}}));
    const exit = () => {
      setRemoteMapControls(false);
      requestAnimationFrame(()=>document.querySelector<HTMLElement>('.map-control-mode[aria-pressed="true"]')?.focus());
    };
    document.addEventListener('bos42:map-controls-exit', exit);
    return () => document.removeEventListener('bos42:map-controls-exit', exit);
  }, [remoteMapControls,remoteMapRotate]);
  const [preferences, setPreferences] = useState(loadPreferences);
  const [demo, setDemo] = useState(false);
  const { feed, now, clockOffset, retry } = useAircraft(demo);
  const harborEnabled = preferences.harbor && !demo;
  const harbor = useHarbor(harborEnabled);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const vessels = useMemo(() => harborEnabled ? harbor.vessels.filter(v => now - v.observedAt < 900000) : [], [harborEnabled, harbor.vessels, now]);
  const selectedVessel = vessels.find(v => v.id === selectedVesselId) || null;
  const harborInterrupted = harbor.status !== 'live';
  const [infoAircraft, setInfoAircraft] = useState<Aircraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<CameraMode>('explore');
  const [weatherOpen, setWeatherOpen] = useState(true);
  const [radioOpen, setRadioOpen] = useState(true);
  const [timelineOpen,setTimelineOpen]=useState(false);
  const [windowOrientation,setWindowOrientation]=useState({bearing:preferences.window.bearing,aligned:false});
  const [settingsOpen, setSettingsOpen] = useState(false), [listOpen, setListOpen] = useState(false);
  const trafficOpen=listOpen||(director&&directorBoard!==null);
  const closeTraffic=()=>{setListOpen(false);setDirectorBoard(null);};
  const autoState = useRef<{id: string | null; arrival: boolean; groundSince: number | null; pinned?: boolean}>({id: null, arrival: false, groundSince: null});
  const map = useRef<MapHandle>(null), settingsClose = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (selectedVesselId && !selectedVessel) { setSelectedVesselId(null); setMode('window'); } }, [selectedVesselId, selectedVessel]);
  const statusTimer = feed.ageSeconds === null ? '' : `${Math.floor(feed.ageSeconds)}s ago`;
  const aircraft = useMemo(() => feed.aircraft.filter(a => (now - a.observedAt) < 90000), [feed.aircraft, now]);
  const approaches=useApproaches(feed.aircraft,demo?Date.now():now,demo,feed.status==='live'||demo);
  const arrivalViews=useMemo(()=>approachViews(approaches.history.tracks,now),[approaches.history.tracks,now]);
  const showingApproaches=mode==='explore'&&scenicView==='Runways';
  const activeApproach=arrivalViews.find(v=>v.id===approachView?.id)||null;
  useEffect(()=>{if(showingApproaches&&!approachView&&arrivalViews.length)setApproachView(arrivalViews[0]);},[showingApproaches,approachView,arrivalViews]);
  const nextArrival = feed.status === 'live' || feed.status === 'demo' ? nextLikelyArrival(aircraft, demo ? Date.now() : now) : null;
  useEffect(() => {
    if (director) return;
    autoState.current = automaticSelection(aircraft, autoState.current, now);
    if (autoState.current.id !== selectedId) setSelectedId(autoState.current.id);
  }, [aircraft, now, selectedId, director]);
  useEffect(() => { savePreferences(preferences); }, [preferences]);
  useEffect(() => { if (preferences.aircraftScaleVersion !== 2) setPreferences(p => ({...p, modelScale: 6, aircraftScaleVersion: 2})); }, [preferences.aircraftScaleVersion]);
  useEffect(() => { try { localStorage.setItem('bos42.camera', mode === 'window' ? 'window' : 'explore'); } catch { /* Storage is optional. */ } }, [mode]);
  useEffect(() => { if (!Number.isFinite(preferences.window.zoom) || !Number.isFinite(preferences.window.tilt)) setPreferences(p => ({...p, window: {...p.window, zoom: p.window.zoom || 2.2, tilt: p.window.tilt || 8, bearing: !p.window.zoom && p.window.bearing === 67 ? 79 : p.window.bearing}})); }, [preferences.window.zoom, preferences.window.tilt]);
  useEffect(() => {
    if (!settingsOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    settingsClose.current?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const dialog = settingsClose.current?.closest('[role="dialog"]');
      const items = [...dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]') || []];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [settingsOpen]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSettingsOpen(false); setListOpen(false); setDirectorBoard(null); } }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, []);
  const selected = aircraft.find(a => a.id === selectedId) || null;
  useEffect(()=>{if(listOpen||settingsOpen||infoAircraft||selectedVesselId||!selectedId)setTimelineOpen(false);},[listOpen,settingsOpen,infoAircraft,selectedVesselId,selectedId]);
  const upcomingArrivals = feed.status === 'live' || feed.status === 'demo' ? arrivalQueue(aircraft.filter(a=>a.id!==nextArrival?.id), demo ? Date.now() : now).slice(0,4) : [];
  const arrivalTime = (seconds: number | null) => seconds === null ? 'ETA —' : seconds < 60 ? '~<1 min' : `~${Math.ceil(seconds / 60)} min`;
  const routeResult = useRoute(selected?.callsign, demo);
  const route = routeFitsAircraft(routeResult.route, selected) ? routeResult.route : null;
  const accent = selectedVessel?.color || selected?.color || '#DCE5E1';
  const selectedAge = selected ? Math.max(0, (now - selected.observedAt) / 1000) : 0;
  const select = (id: string) => { setDirector(false); const flight = aircraft.find(a => a.id === id); if (!flight) return; setSelectedVesselId(null); autoState.current = watchFlight(flight, now); setSelectedId(id); };
  const selectVessel = (id: string) => { setDirector(false); if (!vessels.some(v => v.id === id)) return; setSelectedVesselId(id); setMode('follow'); setListOpen(false); };
  const changeMode = (next: CameraMode) => { setDirector(false); setScenicView(null); if (next === 'follow' && !selected && !selectedVessel) return; if (next === 'explore') map.current?.overview(); if (next === 'window') map.current?.window(); setMode(next); };
  const directorPaused = listOpen || settingsOpen || timelineOpen || !!infoAircraft;
  const directorLatest = useRef({aircraft,vessels,now,history:approaches.history.tracks,live:feed.status === 'live' || demo,harborLive:harbor.status === 'live'});
  directorLatest.current = {aircraft,vessels,now,history:approaches.history.tracks,live:feed.status === 'live' || demo,harborLive:harbor.status === 'live'};
  useEffect(() => {
    if (!director || directorPaused) return;
    const advance = () => {
      if (document.hidden || Date.now() - directorAdvancedAt.current < 250) return;
      directorAdvancedAt.current = Date.now();
      const data = directorLatest.current;
      const scene = directorScene(data.live ? data.aircraft : [], data.harborLive ? data.vessels : [], data.now, directorStep.current++, directorSeen.current,data.history);
      setApproachView(scene.kind==='scenic'?scene.approach||null:null);
      setRemoteMapControls(false);
      setDirectorBoard(scene.kind==='traffic'?scene.filter:null);
      if(scene.kind==='traffic')return;
      if (scene.kind === 'scenic') {
        if(scene.approach)directorSeen.current.set(`approach:${scene.approach.id}`,data.now);
        setMode('explore'); setScenicView(scene.view);
      } else {
        directorSeen.current.set(`${scene.kind}:${scene.id}`, data.now);
        if (directorSeen.current.size > 200) directorSeen.current.delete(directorSeen.current.keys().next().value!);
        setScenicView(null);
        if (scene.kind === 'aircraft') {
          setSelectedVesselId(null);
          const flight = data.aircraft.find(a=>a.id===scene.id);
          if (flight) {autoState.current=watchFlight(flight,data.now);setSelectedId(scene.id);}
        } else setSelectedVesselId(scene.id);
        setMode('follow');
      }
    };
    advance();
    const timer = window.setInterval(advance,15000);
    const visible = () => {if (!document.hidden) advance();};
    document.addEventListener('visibilitychange',visible);
    return () => {clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[director,directorPaused]);
  const statusText = feed.status === 'live' ? 'LIVE' : feed.status === 'demo' ? 'DEMO' : feed.status === 'stale' ? 'STALE' : feed.status === 'connecting' ? 'CONNECTING' : 'OFFLINE';

  const displayedStatus = selectedVessel ? harbor.status : feed.status;
  const displayedStatusText = selectedVessel ? harbor.status === 'live' ? 'LIVE' : harbor.status === 'connecting' ? 'CONNECTING' : harbor.status === 'stale' ? 'STALE' : 'OFFLINE' : statusText;
  const displayedAge = selectedVessel ? `AIS · ${Math.floor(Math.max(0, now - selectedVessel.observedAt) / 1000)}s ago` : feed.status === 'demo' ? 'Sample flights' : statusTimer || 'Connecting feed';
  const cockpit = mode === 'follow' && (!!selected || !!selectedVessel);
  const cameraControls = <nav className="camera-controls header-camera-controls" aria-label="Camera view">
    <button onClick={() => changeMode('window')} aria-label="Window view" title="Window view" aria-pressed={mode === 'window'}><ControlIcon name="window"/><span>Window</span></button>
    <button onClick={() => { changeMode('explore'); if (import.meta.env.VITE_TIZEN_APP) {setRemoteMapRotate(false);setRemoteMapControls(true);} }} aria-label="Explore" title="Explore" aria-pressed={mode === 'explore' && !scenicView}><ControlIcon name="explore"/><span>Explore</span></button>
    <button onClick={() => {setRemoteMapControls(false);if (!director) {directorStep.current=6;directorAdvancedAt.current=0;}setDirector(value=>!value);}} aria-label={director ? 'Stop Director mode' : 'Start Director mode'} title="Director: automatic scenes" aria-pressed={director}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z"/></svg><span>Director</span></button>
  </nav>;
  const nextCard = <section className="flight-card next-arrivals-card" aria-label="Landing aircraft and next arrivals">
    {nextArrival ? <button className="landing-aircraft" onClick={()=>{select(nextArrival.id);setMode('follow');}} aria-label={`Follow landing aircraft ${nextArrival.registration || nextArrival.label}`}>
      <span className="landing-eyebrow">LANDING</span><strong className="landing-tail">{nextArrival.registration || nextArrival.label}</strong>
      <span className="landing-operator">{nextArrival.operator} · {nextArrival.label}</span>
      <span className="landing-distance">{nextArrival.distanceNm.toFixed(1)} NM from Logan</span>
    </button> : <div className="landing-empty"><span className="landing-eyebrow">LANDING</span><strong>{feed.status==='live'||demo?'No approaching aircraft':'Waiting for aircraft'}</strong></div>}
    <div className="arrival-queue" aria-label="Tail number, distance and estimated time to Logan">
      <div className="arrival-queue-heading"><strong>Next</strong><small>NM · est. to Logan</small></div>
      {upcomingArrivals.map(({aircraft:a,seconds})=><button key={a.id} className={`arrival-queue-row ${mode === 'follow' && !selectedVessel && a.id === selectedId ? 'is-current' : ''}`} aria-current={mode === 'follow' && !selectedVessel && a.id === selectedId ? 'true' : undefined} onClick={()=>{select(a.id);setMode('follow');}} aria-label={`Follow ${a.registration || a.label}, ${a.distanceNm.toFixed(1)} nautical miles, ${arrivalTime(seconds)}`}><strong className="arrival-tail">{a.registration || a.label}</strong><span className="arrival-distance">{a.distanceNm.toFixed(1)} NM</span><b className="arrival-time">{arrivalTime(seconds)}</b></button>)}
      {!upcomingArrivals.length && <p className="arrival-queue-empty">{feed.status === 'live' || demo ? 'No approaching aircraft right now.' : 'Waiting for fresh aircraft updates.'}</p>}
    </div>
  </section>;
  return <div className={`app ${cockpit ? 'cockpit-active' : ''} ${preferences.television ? 'tv-mode' : ''} ${trafficOpen?'traffic-open':''}`} style={{ '--accent': accent, '--accent-ink': contrast(accent) } as React.CSSProperties}>
    <main className="airspace">
      {remoteMapControls && <div role="status" style={{position:'absolute',zIndex:30,bottom:70,left:24,padding:'16px 20px',borderRadius:10,background:'#10232def',color:'#eef2ed',fontSize:18,pointerEvents:'none'}}>{remoteMapRotate ? '↑ / ↓ Tilt · ← / → Rotate' : '↑ / ↓ / ← / → Pan'} · CH + / −: Zoom · OK or Back: Choose controls</div>}
      {mode === 'explore' && !director && <div className="tilt-controls" role="group" aria-label="Explore controls">
        {import.meta.env.VITE_TIZEN_APP && <>
          <button className="map-control-mode" aria-label="Pan map with arrow keys" aria-pressed={!remoteMapRotate} onClick={()=>{setDirector(false);setRemoteMapRotate(false);setRemoteMapControls(true);}}><span>Pan</span></button>
          <button className="map-control-mode" aria-label="Tilt and rotate with arrow keys" aria-pressed={remoteMapRotate} onClick={()=>{setDirector(false);setRemoteMapRotate(true);setRemoteMapControls(true);}}><span>Tilt / Rotate</span></button>
        </>}
        <button aria-label="Tilt camera up" title="Tilt up" onClick={()=>{setDirector(false);document.dispatchEvent(new CustomEvent('bos42:map-command',{detail:'tilt-up'}));}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 14 7-8 7 8M5 19h14"/></svg><span>Tilt up</span></button>
        <button aria-label="Tilt camera down" title="Tilt down" onClick={()=>{setDirector(false);document.dispatchEvent(new CustomEvent('bos42:map-command',{detail:'tilt-down'}));}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 10 7 8 7-8M5 5h14"/></svg><span>Tilt down</span></button>
      </div>}
      <MapBoundary><MapView approachView={showingApproaches?approachView:null} approachTracks={showingApproaches?activeApproach?.tracks:undefined} scenicView={mode === 'explore' ? scenicView : null} apartmentView={mode === 'explore' && scenicView === 'Apartment'} gentleTransitions={director} ref={map} vessels={vessels} selectedVesselId={selectedVesselId} onSelectVessel={selectVessel} aircraft={aircraft} selectedId={selectedId} mode={mode} preferences={preferences} clockOffset={demo ? 0 : clockOffset} onSelect={id => { select(id); setMode('follow'); }} onExplore={() => {setDirector(false);setScenicView(null);setMode('explore');}} onLocate={id => {select(id); setMode('follow');}} onWindowOrientation={setWindowOrientation} onWindowZoom={delta => setPreferences(p => ({...p, window: {...p.window, zoom: Math.max(1, Math.min(3.5, (p.window.zoom || 2.2) + delta))}}))} /></MapBoundary>
      <header className="app-header">
        <div className="header-actions"><div className={`feed-status status-${displayedStatus}`}><i /><span aria-live="polite">{displayedStatusText}</span><small>{displayedAge}</small></div>{cameraControls}<button className={`traffic-button ${trafficOpen ? 'active' : ''}`} onClick={() => {if(trafficOpen)closeTraffic();else {setDirectorBoard(null);setListOpen(true);}}} aria-label={`Traffic, ${aircraft.length} aircraft and ${vessels.length} vessels`} aria-expanded={trafficOpen}><ControlIcon name="traffic"/><span>Traffic</span><strong>{aircraft.length + vessels.length}</strong></button><button className="weather-button" aria-label="Logan and Boston Harbor weather" aria-expanded={weatherOpen} aria-controls="coastal-weather" onClick={() => setWeatherOpen(value => !value)}><WeatherIcon/><span>Weather</span></button><button className="atc-button" aria-label="ATC radio" aria-expanded={radioOpen} aria-controls="atc-radio" onClick={() => setRadioOpen(value => !value)}><RadioIcon/><span>ATC</span></button><FullscreenButton/><button className="icon-button settings-button" aria-label="Settings" onClick={() => setSettingsOpen(true)}><ControlIcon name="settings"/></button></div>
      </header>
      {(feed.status === 'stale' || feed.status === 'unavailable') && <div className="feed-warning" role="status"><strong>{feed.status === 'stale' ? 'Live updates interrupted' : 'Live feed unavailable'}</strong><span>{feed.status === 'stale' ? 'Old positions are marked and stop moving. Reconnecting automatically.' : feed.error || 'Reconnecting automatically. No simulated flights are being shown.'}</span><button onClick={retry}>Retry now</button></div>}
      {demo && <div className="demo-banner">SIMULATED FLIGHTS<button onClick={() => { setDemo(false); setSelectedId(null); }}>Return to live</button></div>}
      {trafficOpen && <TrafficBoard initialFilter={directorBoard||'all'} automatic={director&&!listOpen} onInteract={()=>{if(director){setListOpen(true);setDirector(false);}}} vessels={vessels} harborStatus={harbor.status} harborEnabled={harborEnabled} selectedVesselId={selectedVesselId} onSelectVessel={selectVessel} aircraft={aircraft} selectedId={selectedId} selectedRoute={route} status={feed.status} now={now} onClose={closeTraffic} onSelect={id => { select(id); setListOpen(false); setMode('follow'); }} />}
      <div className="observation-panels">
      {weatherOpen && <CoastalWeather/>}
      {showingApproaches&&!trafficOpen&&!settingsOpen&&<ApproachViews views={arrivalViews} activeId={activeApproach?.id||null} source={approaches.source} onSelect={view=>{setDirector(false);setApproachView(view);setScenicView('Runways');setMode('explore');}}/>}
      {mode === 'follow' && selectedVessel && <VesselCard vessel={selectedVessel} now={now} interrupted={harborInterrupted}/>}
      {mode === 'follow' && selected && !selectedVessel && <FollowFacts key={`${selected.id}:${selected.aircraftType}`} aircraft={selected} onInfo={()=>setInfoAircraft(selected)}/>}
      <div className="left-flight-panels">{nextCard}</div>
      {timelineOpen&&selected&&!selectedVessel&&<FlightTimeline key={`${selected.id}:${selected.callsign}`} aircraft={selected} route={route} now={now} demo={demo} onClose={()=>setTimelineOpen(false)}/>}
      <div className={`instrument-dock ${trafficOpen ? 'with-traffic' : ''}`}>
      {cockpit && !selectedVessel && selected && <section className="cockpit-overlay" aria-label="Follow instruments"><FlightGauges key={selected.id} aircraft={selected} now={now} interrupted={feed.status === 'stale' || feed.status === 'unavailable'} demo={demo}/></section>}
      {cockpit && selectedVessel && <section className="cockpit-overlay vessel-instruments" aria-label="Vessel instruments"><VesselGauges vessel={selectedVessel} now={now} interrupted={harborInterrupted}/></section>}
      {radioOpen && <AtcRadio callsign={selectedVessel ? undefined : selected?.callsign} onClose={() => setRadioOpen(false)}/>}
      </div>
      </div>
      <Spotter aircraft={aircraft} home={preferences.window} now={demo?Date.now():now} selectedId={selectedId} enabled={preferences.spotting&&(feed.status==='live'||demo)} visible={mode==='window'&&!trafficOpen&&!settingsOpen&&!timelineOpen&&!infoAircraft} sound={preferences.spottingSound&&!demo} view={windowOrientation} onFollow={id=>{select(id);setMode('follow');}}/>
    </main>
    {selectedVessel ? <VesselTicker vessel={selectedVessel} now={now} interrupted={harborInterrupted}/> : <FlightTicker gaugesVisible={cockpit} aircraft={selected} route={route} aircraftName={selected ? typeName(selected) : ''} stale={!!selected && selectedAge > 20} nextArrival={nextArrival} trafficStatus={feed.status}/>}

    <footer className="app-footer"><span>{feed.status === 'demo' ? 'DEMO · SIMULATED POSITIONS' : `${feed.providerName || 'ADSB.lol'} · ${feed.status === 'live' ? `updated ${statusTimer}` : statusText.toLowerCase()}`} {harborEnabled && ` · AISStream · ${harbor.status === 'live' ? `${vessels.length} vessels` : harbor.status}`}</span><span>Illustrative models · estimated motion</span></footer>
    {infoAircraft && <AircraftInfo aircraft={infoAircraft} onClose={() => setInfoAircraft(null)}/>}
    {settingsOpen && <div className="settings-scrim" onClick={event => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="drawer-heading"><div><small>BOS / 42</small><h2 id="settings-title">Your airspace</h2></div><button ref={settingsClose} className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button></div>
      <div className="settings-section"><h3>Your window</h3><p>South Station Tower · floor 42. The starting height and direction are approximate.</p><label className="range-label">Viewing direction <strong>{Math.round(preferences.window.bearing)}°</strong><input type="range" min="20" max="120" step="1" value={preferences.window.bearing} onChange={e => { setPreferences(p => ({ ...p, window: { ...p.window, bearing: Number(e.target.value) } })); setMode('window'); }} /></label><label className="range-label">Window zoom <strong>{(preferences.window.zoom || 2.2).toFixed(1)}×</strong><input type="range" min="1" max="3.5" step=".1" value={preferences.window.zoom || 2.2} onChange={e => { setPreferences(p => ({ ...p, window: { ...p.window, zoom: Number(e.target.value) } })); setMode('window'); }} /></label><label className="range-label">Perspective angle <strong>{preferences.window.tilt || 8}°</strong><input type="range" min="1" max="16" step="1" value={preferences.window.tilt || 8} onChange={e => { setPreferences(p => ({ ...p, window: { ...p.window, tilt: Number(e.target.value) } })); setMode('window'); }} /></label><p>Higher angles lift the virtual camera to open up the runway layout. Set 1° to return to the floor-42 viewpoint.</p><label className="range-label">Floor-42 eye height above sea level <strong>{preferences.window.altitudeM} m</strong><input type="range" min="100" max="230" step="1" value={preferences.window.altitudeM} onChange={e => { setPreferences(p => ({ ...p, window: { ...p.window, altitudeM: Number(e.target.value) } })); setMode('window'); }} /></label><button className="secondary-button" onClick={() => { setPreferences(p => ({...p, window: {...DEFAULT_PREFERENCES.window}})); setMode('window'); }}>Reset window view</button></div>
      <div className="settings-section"><h3>Rendering</h3><label className="switch-row"><span>Harbor vessels alongside planes</span><input type="checkbox" checked={preferences.harbor} onChange={e => setPreferences(p => ({...p, harbor:e.target.checked}))}/></label><label className="switch-row"><span>Aircraft labels</span><input type="checkbox" checked={preferences.labels} onChange={e => setPreferences(p => ({ ...p, labels: e.target.checked }))} /></label><label className="switch-row"><span>Selected flight’s recent trail</span><input type="checkbox" checked={preferences.trails} onChange={e => setPreferences(p => ({ ...p, trails: e.target.checked }))} /></label><label className="switch-row"><span>Show aircraft on the ground</span><input type="checkbox" checked={preferences.ground} onChange={e => setPreferences(p => ({ ...p, ground: e.target.checked }))} /></label><label className="range-label">Aircraft size <strong>{preferences.modelScale.toFixed(1)}×</strong><input type="range" min="1" max="12" step=".5" value={preferences.modelScale} onChange={e => setPreferences(p => ({ ...p, modelScale: Number(e.target.value) }))} /></label><label className="switch-row"><span>Large display text</span><input type="checkbox" checked={preferences.television} onChange={e => setPreferences(p => ({ ...p, television: e.target.checked }))} /></label><p>Aircraft colors follow their operating airline. Callsigns may differ from marketed codeshare flights.</p></div>
      <div className="settings-section"><h3>Look over there</h3><label className="switch-row"><span>Aircraft spotting alerts</span><input type="checkbox" checked={preferences.spotting} onChange={e=>setPreferences(p=>({...p,spotting:e.target.checked}))}/></label><label className="switch-row"><span>Quiet spotting chime</span><input type="checkbox" checked={preferences.spottingSound} onChange={e=>{const checked=e.target.checked;if(checked)enableSpotterSound();setPreferences(p=>({...p,spottingSound:checked}));}}/></label><p>In Window, points toward nearby wide-body arrivals, known private or cargo operators, and helicopters. One alert at most every 90 seconds; the same flight stays quiet for 30 minutes. Directions are approximate and do not account for buildings or clouds. Tap an alert to Follow.</p></div>
      <div className="settings-section"><h3>Connection</h3><p>Live positions refresh about every 5 seconds. Aircraft motion is estimated for up to 8 seconds, then held until another report. Boats use AISStream and predict movement for at most 20 seconds. Boat shapes are illustrative; reported dimensions and destinations can be incomplete or outdated. Harbor coverage can vary. “Likely arrival” is inferred from motion, not an ATC clearance.</p><div className="connection-details"><span>Feed</span><strong>{feed.providerName || 'Not connected'}</strong><span>Aircraft received</span><strong>{feed.aircraft.length}</strong><span>Coverage</span><strong>40 NM around Logan</strong></div><button className="secondary-button" onClick={() => { retry(); setSettingsOpen(false); }}>Reconnect live feed</button><button className="secondary-button" onClick={() => { setDemo(v => !v); setSelectedId(null); setSettingsOpen(false); }}>{demo ? 'Switch to live feed' : 'Try simulated flights'}</button></div>
      <div className="settings-section about"><h3>Sources &amp; airport status</h3><p><a href={feed.attribution || 'https://www.adsb.lol'} target="_blank" rel="noreferrer">{feed.providerName || 'ADSB.lol'}</a> · <a href="https://www.adsbdb.com" target="_blank" rel="noreferrer">adsbdb routes</a> · <a href="https://aisstream.io" target="_blank" rel="noreferrer">AISStream vessels</a> · <a href="https://www.fly.faa.gov/fly/flyfaa/flyfaaindex?ARPT=BOS&amp;p=1" target="_blank" rel="noreferrer">FAA Boston status</a></p><p>Built for watching from your window. Not for navigation. Public feed access is for this personal prototype; no uptime guarantee. GPS heights are converted to sea level using EGM96; barometric fallback heights remain pressure based. The basemap uses mapped building heights. Buildings within 150 m of your window are cut away in that camera view. Published routes can lag schedule changes.</p></div>
    </section></div>}
  </div>;
}
