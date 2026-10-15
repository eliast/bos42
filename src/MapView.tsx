import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as LibreMap } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { airportStyle } from './mapStyle';
import { AircraftLayer } from './AircraftLayer';
import { VesselLayer } from './VesselLayer';
import { projectedVessel } from './vesselMotion.mjs';
import type { Vessel } from './harborTypes';
import { EXPLORE_CAMERA } from './config';
import { destination, projectedPosition } from '../shared/aviation.mjs';
import type { Aircraft, CameraMode, Preferences } from './types';
import { smoothView, clamp } from './lookOrientation.mjs';
import { LookSession } from './lookSession.mjs';
import { startMotionInput } from './motionInput';
import { towerAlignmentPose, apartmentViewPose } from './windowAlignment.mjs';
import { mapPixelRatio, televisionRenderer } from './renderProfile.mjs';
import {approachCamera,type ApproachView,type ApproachTrack} from '../shared/approaches.mjs';
import {smoothFollowCamera,type FollowCamera} from '../shared/followCamera.mjs';

// MapLibre 6 needs its worker bundled explicitly in production and Capacitor.
maplibregl.setWorkerUrl(mapWorkerUrl);

type LookInput = 'off' | 'motion';
type LookPose = { bearing: number; tilt: number };

export type ScenicView = 'Runways' | 'Harbor' | 'Skyline' | 'Apartment';
const SCENIC_CAMERAS: Record<Exclude<ScenicView,'Apartment'>, {center: [number, number]; zoom: number; pitch: number; bearing: number}> = {
  Runways: {center: [-71.0096, 42.3626], zoom: 13.5, pitch: 58, bearing: 35},
  Harbor: {center: [-71.035, 42.349], zoom: 13.3, pitch: 58, bearing: 65},
  Skyline: {center: [-71.055, 42.355], zoom: 14.2, pitch: 65, bearing: -65},
};

export interface MapHandle { window: () => void; zoomIn: () => void; zoomOut: () => void; north: () => void; overview: () => void; focus: (id: string) => void; }
interface Props {
  approachView?:ApproachView|null;
  approachTracks?:ApproachTrack[];
  gentleTransitions?: boolean;
  apartmentView?: boolean;
  scenicView?: ScenicView | null;
  aircraft: Aircraft[]; selectedId: string | null; mode: CameraMode;
  vessels: Vessel[]; selectedVesselId: string | null; onSelectVessel: (id: string) => void;
  preferences: Preferences; clockOffset: number;
  onSelect: (id: string) => void; onExplore: () => void; onLocate: (id: string) => void;
  onWindowZoom: (delta: number) => void;
  onWindowOrientation?: (view:{bearing:number;aligned:boolean}) => void;
}
export const MapView = forwardRef<MapHandle, Props>(function MapView(props, ref) {
  const container = useRef<HTMLDivElement>(null), mapRef = useRef<LibreMap | null>(null), layerRef = useRef<AircraftLayer | null>(null);
  const vesselsRef = useRef<VesselLayer | null>(null);
  const latest = useRef(props); latest.current = props;
  const [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null);
  const [bearing, setBearing] = useState(0);
  const [lookInput, setLookInput] = useState<LookInput>('off');
  const [lookMessage, setLookMessage] = useState('');
  const [sighting, setSighting] = useState(true);
  const sightingRef = useRef(true); sightingRef.current = sighting;
  const [motionStarting, setMotionStarting] = useState(false);
  const lookInputRef = useRef<LookInput>('off');
  const lookSession = useRef(new LookSession());
  const motionStop = useRef<(() => void) | null>(null);
  const motionGeneration = useRef(0), motionPending = useRef(false), alignPending = useRef(false);
  const motionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentLook = useRef<LookPose | null>(null), targetLook = useRef<LookPose | null>(null);
  const lookFrame = useRef<number | null>(null);
  const lastFrame = useRef(0), lastRender = useRef(0);
  const homeMarker = useRef<maplibregl.Marker | null>(null);
  const focusFrame = useRef<number | null>(null);
  const applyWindowCamera = (map: LibreMap, animate: boolean, pose?: LookPose) => {
    const home = latest.current.preferences.window;
    const width = map.getContainer().clientWidth, height = map.getContainer().clientHeight;
    if (!width || !height) return;
    // Keep the window's horizontal position and lens. Perspective tilt lifts
    // the virtual eye above the window to reveal the airport's runway layout.
    const horizontalFov = 2 * Math.atan(Math.tan(40 * Math.PI / 180) / (home.zoom || 2.2));
    const verticalFov = 2 * Math.atan(Math.tan(horizontalFov / 2) * height / width) * 180 / Math.PI;
    map.setVerticalFieldOfView(verticalFov);
    const baseTilt = (home.tilt || 8) * Math.PI / 180;
    // Preserve one virtual eye position while looking around. The saved
    // elevated perspective is an artistic offset, not the user's real height.
    const eyeHeight = Math.max(home.altitudeM, 8 + 4000 * Math.tan(baseTilt));
    const baseTarget = destination(home, home.bearing, (eyeHeight - 8) / Math.tan(baseTilt));
    const baseCamera = map.calculateCameraOptionsFromTo(new maplibregl.LngLat(home.lon, home.lat), eyeHeight, new maplibregl.LngLat(baseTarget.lon, baseTarget.lat), 8);
    layerRef.current?.setWindowScaleZoom(baseCamera.zoom ?? null);
    const tilt = (pose ? clamp(pose.tilt, 3, 45) : (home.tilt || 8)) * Math.PI / 180;
    const target = destination(home, pose?.bearing ?? home.bearing, (eyeHeight - 8) / Math.tan(tilt));
    const camera = pose ? map.calculateCameraOptionsFromTo(new maplibregl.LngLat(home.lon, home.lat), eyeHeight, new maplibregl.LngLat(target.lon, target.lat), 8) : baseCamera;
    const options = { ...camera, padding: { top: 0, bottom: 0, left: 0, right: 0 } };
    // flyTo/easeTo do not apply CameraOptions.elevation in this MapLibre
    // version. Set it explicitly and prevent the render loop resetting it.
    map.setCenterElevation(8);
    if (animate) map.flyTo({ ...options, duration: 1100, essential: true }); else map.jumpTo(options);
  };

  const homePose = () => ({ bearing: latest.current.preferences.window.bearing, tilt: latest.current.preferences.window.tilt || 8 });

  const alignLook = () => {
    if (!lookSession.current.align(towerAlignmentPose(latest.current.preferences.window), performance.now())) {
      alignPending.current = true;
      setLookMessage('Waiting for a fresh motion reading.'); return;
    }
    const pose = lookSession.current.view(performance.now());
    currentLook.current = pose; targetLook.current = pose;
    lookInputRef.current = 'motion'; setLookInput('motion');
    sightingRef.current = false; setSighting(false);
    setLookMessage('Aligned to Logan control tower.');
    const map = mapRef.current;
    if (map && pose && latest.current.mode === 'window') applyWindowCamera(map, false, pose);
  };

  const startLook = async (align = false) => {
    if (motionPending.current) { if (align) alignPending.current = true; return; }
    if (!align && lookInputRef.current === 'motion') return;
    if (motionStop.current) {
      if (align) { alignLook(); return; }
      lookInputRef.current = 'motion'; setLookInput('motion');
      targetLook.current = lookSession.current.view(performance.now());
      currentLook.current = targetLook.current;
      setLookMessage(lookSession.current.needsAlignment ? 'Aim at Logan control tower and tap the target.' : '');
      return;
    }
    const generation = ++motionGeneration.current;
    motionPending.current = true; setMotionStarting(true); alignPending.current = align;
    lookInputRef.current = 'motion'; setLookInput('motion');
    setLookMessage('Connecting motion…');
    let received = false;
    const fail = (message: string) => {
      if (motionGeneration.current !== generation) return;
      ++motionGeneration.current;
      motionStop.current?.(); motionStop.current = null;
      if (motionTimer.current) clearTimeout(motionTimer.current);
      setSighting(true); sightingRef.current = true;
      lookSession.current.invalidate();
      lookInputRef.current = 'off'; setLookInput('off');
      currentLook.current = null; targetLook.current = null;
      motionPending.current = false; setMotionStarting(false); setLookMessage(message);
    };
    try {
      const stop = await startMotionInput(sample => {
        if (motionGeneration.current !== generation) return;
        const now = performance.now(), wasAligned = !lookSession.current.needsAlignment;
        if (!lookSession.current.receive(sample, sample.sessionID, homePose(), now)) return;
        if (alignPending.current) { alignPending.current = false; alignLook(); }
        else if (!received) setLookMessage(lookSession.current.needsAlignment ? 'Aim at Logan control tower and tap the target.' : 'Aim at Logan control tower and tap the target.');
        else if (wasAligned && lookSession.current.needsAlignment) setLookMessage('Motion restarted. Aim at Logan control tower and tap the target.');
        received = true;
        if (motionTimer.current) clearTimeout(motionTimer.current);
        motionTimer.current = setTimeout(() => {
          if (!document.hidden) fail('Motion readings stopped. Tap the target to reconnect.');
        }, 5000);
        const pose = lookSession.current.view(now);
        targetLook.current = pose;
        if (!currentLook.current && lookInputRef.current === 'motion') currentLook.current = pose;
      }, () => {
        if (motionGeneration.current !== generation) return;
        if (motionTimer.current) { clearTimeout(motionTimer.current); motionTimer.current = null; }
        setSighting(true); sightingRef.current = true;
        lookSession.current.invalidate(); targetLook.current = null; currentLook.current = null;
        setLookMessage('Motion paused. Aim at Logan control tower and tap the target when you return.');
      }, fail);
      if (generation !== motionGeneration.current) { stop(); return; }
      motionStop.current = stop;
      if (!received) motionTimer.current = setTimeout(() => fail('No motion readings arrived. Tap the target to retry, or use Explore.'), 5000);
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Motion is unavailable. Use Explore to move the map.');
    } finally {
      if (generation === motionGeneration.current) { motionPending.current = false; setMotionStarting(false); }
    }
  };

  // Window is always motion-driven; retain the sensor session while exploring.
  useEffect(() => {
    if (ready && props.mode === 'window') void startLook();
  }, [ready, props.mode]);

  useEffect(() => () => {
    ++motionGeneration.current;
    motionStop.current?.();
    if (motionTimer.current) clearTimeout(motionTimer.current);
  }, []);

  const applyScenicCamera = (view: ScenicView) => {
    const map = mapRef.current;
    if (!map) return;
    map.resize(); map.setVerticalFieldOfView(36.87);
    map.setPadding({top:0,bottom:0,left:0,right:0});
    map.setCenterElevation(0);
    let camera;
    if (view === 'Apartment') {
      const home = latest.current.preferences.window;
      const {eye,target} = apartmentViewPose(home);
      const horizontalFov = 2 * Math.atan(Math.tan(40 * Math.PI / 180) / (home.zoom || 2.2));
      const {clientWidth:width,clientHeight:height} = map.getContainer();
      if (width && height) map.setVerticalFieldOfView(2 * Math.atan(Math.tan(horizontalFov / 2) * height / width) * 180 / Math.PI);
      map.setCenterElevation(target.altitudeM);
      camera = map.calculateCameraOptionsFromTo(new maplibregl.LngLat(eye.lon,eye.lat),eye.altitudeM,new maplibregl.LngLat(target.lon,target.lat),target.altitudeM);
    } else if(view==='Runways'&&latest.current.approachView){
      const {eye,target}=approachCamera(latest.current.approachView);
      map.setCenterElevation(target.altitudeM);
      camera=map.calculateCameraOptionsFromTo(new maplibregl.LngLat(eye.lon,eye.lat),eye.altitudeM,new maplibregl.LngLat(target.lon,target.lat),target.altitudeM);
    } else camera = SCENIC_CAMERAS[view];
    map.flyTo({...camera, duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 4200, essential:false});
  };

  useImperativeHandle(ref, () => ({
    window: () => { setSighting(true); sightingRef.current = true; void startLook(); },
    zoomIn: () => { if (latest.current.mode === 'window') latest.current.onWindowZoom(.2); else { latest.current.onExplore(); mapRef.current?.zoomIn({ duration: 350 }); } },
    zoomOut: () => { if (latest.current.mode === 'window') latest.current.onWindowZoom(-.2); else { latest.current.onExplore(); mapRef.current?.zoomOut({ duration: 350 }); } },
    north: () => { latest.current.onExplore(); mapRef.current?.easeTo({ bearing: 0, duration: 700 }); },
    overview: () => { const map = mapRef.current; if (!map) return; map.setCenterElevation(0); map.flyTo({ ...EXPLORE_CAMERA, duration: 1300, essential: true }); },
    focus: id => {
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
      // Wait for Explore's layout to replace the window sensor crop.
      focusFrame.current = requestAnimationFrame(() => {
        focusFrame.current = null;
        const a = latest.current.aircraft.find(a => a.id === id), map = mapRef.current;
        if (!a || !map) return;
        map.resize(); map.setVerticalFieldOfView(36.87);
        const p = projectedPosition(a, Date.now() + latest.current.clockOffset);
        const behind = destination(p, a.heading + 155, 3000);
        const camera = map.calculateCameraOptionsFromTo(new maplibregl.LngLat(behind.lon, behind.lat), p.altitudeFt * .3048 + 2000, new maplibregl.LngLat(p.lon, p.lat), p.altitudeFt * .3048);
        map.setCenterElevation(p.altitudeFt * .3048);
        map.flyTo({ ...camera, duration: 1300, essential: true });
      });
    },
  }));

  useEffect(() => {
    const command = (event: Event) => {
      const map = mapRef.current;
      if (!map) return;
      const action = (event as CustomEvent<string>).detail;
      const pan = ({'pan-left':[-90,0],'pan-right':[90,0],'pan-up':[0,-90],'pan-down':[0,90]} as Record<string,[number,number]>)[action];
      if (pan) map.panBy(pan, {duration:160, easing:t=>t, essential:true});
      else if (action === 'rotate-left' || action === 'rotate-right') map.easeTo({bearing:map.getBearing()+(action==='rotate-left'?-8:8),duration:160,essential:true});
      else if (action === 'tilt-up' || action === 'tilt-down') map.easeTo({pitch:Math.max(0,Math.min(80,map.getPitch()+(action==='tilt-up'?5:-5))),duration:160,essential:true});
      else if (action === 'zoom-in' || action === 'zoom-out') map.easeTo({zoom:map.getZoom()+(action==='zoom-in' ? .25 : -.25),duration:180,essential:true});
    };
    document.addEventListener('bos42:map-command', command);
    return () => document.removeEventListener('bos42:map-command', command);
  }, []);

  useEffect(() => {
    if (!container.current) return;
    let map: LibreMap;
    try {
      map = new maplibregl.Map({ container: container.current, style: airportStyle, ...EXPLORE_CAMERA, maxPitch: 89, minZoom: 8, maxZoom: 18, maxBounds: [[-72.2, 41.8], [-70.1, 42.9]], attributionControl: false, canvasContextAttributes: { antialias: !televisionRenderer, preserveDrawingBuffer: false }, pixelRatio: mapPixelRatio(container.current.clientWidth, container.current.clientHeight, window.devicePixelRatio, televisionRenderer), dragRotate: true, touchPitch: true, fadeDuration: 150 });
    } catch { setError('This browser could not start the 3D renderer. Try Safari on your iPad or a browser with WebGL enabled.'); return; }
    mapRef.current = map;
    map.setCenterClampedToGround(false);
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    const startupTimer = window.setTimeout(() => {
      if (!layerRef.current) setError('The map has not loaded. Check your connection and reload to try again.');
    }, 20000);
    map.on('load', () => {
      clearTimeout(startupTimer);
      if (!container.current) return;
      const layer = new AircraftLayer(container.current, latest.current.preferences, id => latest.current.onSelect(id), id => latest.current.onLocate(id));
      layerRef.current = layer; map.addLayer(layer);
      layer.update(latest.current.aircraft, latest.current.clockOffset); layer.setSelection(latest.current.selectedVesselId ? null : latest.current.selectedId);
      const vessels = new VesselLayer(container.current, id => latest.current.onSelectVessel(id));
      vesselsRef.current = vessels; map.addLayer(vessels); vessels.update(latest.current.vessels, latest.current.clockOffset); vessels.setSelection(latest.current.selectedVesselId);
      const home = document.createElement('div'); home.className = 'home-marker';
      const dot = document.createElement('span'), text = document.createElement('strong'); text.textContent = 'YOUR WINDOW / 42'; home.append(dot, text);
      homeMarker.current = new maplibregl.Marker({ element: home, anchor: 'bottom' }).setLngLat([latest.current.preferences.window.lon, latest.current.preferences.window.lat]).addTo(map);
      setReady(true); setError(null);
      console.info('BOS/42 map ready');
    });
    map.on('error', event => {
      console.warn('Map source:', event.error.message);
      if (!layerRef.current) setError('The 3D map could not load. Reload to try again.');
      else if (/Failed to fetch|AJAXError|NetworkError/i.test(event.error.message)) setError('Map tiles are taking longer to load. Aircraft data will keep updating.');
    });
    map.on('sourcedata', event => { if (layerRef.current && event.isSourceLoaded) setError(null); });
    map.on('rotate', () => setBearing(Math.round(map.getBearing())));
    map.on('dragstart', () => latest.current.onExplore());
    map.on('rotatestart', e => { if (e.originalEvent) latest.current.onExplore(); });
    map.on('pitchstart', e => { if (e.originalEvent) latest.current.onExplore(); });
    map.on('zoomstart', e => { if (e.originalEvent) latest.current.onExplore(); });
    map.on('click', event => { const id = layerRef.current?.pick(event.point.x, event.point.y); if (id) latest.current.onSelect(id); else { const vesselId = vesselsRef.current?.pick(event.point.x, event.point.y); if (vesselId) latest.current.onSelectVessel(vesselId); } });
    const visibility = () => layerRef.current?.setPaused(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const resize = new ResizeObserver(() => {
      const element = map.getContainer();
      const ratio = mapPixelRatio(element.clientWidth, element.clientHeight, window.devicePixelRatio, televisionRenderer);
      if (map.getPixelRatio() !== ratio) map.setPixelRatio(ratio);
      map.resize();
      if (layerRef.current && latest.current.mode === 'window') applyWindowCamera(map, false, currentLook.current ?? undefined);
    }); resize.observe(container.current);
    const contextLost = (event: Event) => { event.preventDefault(); setError('The 3D renderer was interrupted. Reload to reconnect.'); };
    map.getCanvas().addEventListener('webglcontextlost', contextLost);
    return () => { clearTimeout(startupTimer); if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current); if (lookFrame.current !== null) cancelAnimationFrame(lookFrame.current); resize.disconnect(); document.removeEventListener('visibilitychange', visibility); map.getCanvas().removeEventListener('webglcontextlost', contextLost); homeMarker.current?.remove(); layerRef.current?.dispose(); vesselsRef.current?.dispose(); vesselsRef.current = null; map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => { layerRef.current?.update(props.aircraft, props.clockOffset); }, [props.aircraft, props.clockOffset, ready]);
  useEffect(()=>{if(ready&&props.mode==='window')latest.current.onWindowOrientation?.({bearing:Math.round(bearing),aligned:!sighting&&lookInput==='motion'});},[bearing,ready,sighting,lookInput,props.mode]);
  useEffect(() => { layerRef.current?.setFollowing(props.mode === 'follow'); }, [props.mode, ready]);
  useEffect(() => { layerRef.current?.setSelection(props.selectedVesselId ? null : props.selectedId); vesselsRef.current?.setSelection(props.selectedVesselId); }, [props.selectedId, props.selectedVesselId, ready]);
  useEffect(() => { vesselsRef.current?.update(props.vessels, props.clockOffset); }, [props.vessels, props.clockOffset, ready]);
  useEffect(() => { vesselsRef.current?.setFollowing(props.mode === 'follow'); }, [props.mode, ready]);
  useEffect(() => { layerRef.current?.setPreferences(props.preferences); }, [props.preferences, ready]);
  useEffect(()=>{
    const update=()=>layerRef.current?.setApproachTrails(props.scenicView==='Runways'?props.approachTracks||[]:[],Date.now()+props.clockOffset);
    update();const timer=window.setInterval(update,5000);
    return()=>window.clearInterval(timer);
  },[props.approachTracks,props.scenicView,props.clockOffset,ready]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !layerRef.current) return;
    const fromApartment = props.mode === 'window' || props.apartmentView;
    map.setLayoutProperty('places', 'visibility', fromApartment ? 'none' : 'visible');
    map.setLayoutProperty('airport-name', 'visibility', fromApartment ? 'none' : 'visible');
    // Cut away only the tower immediately surrounding the viewpoint. The
    // camera remains at the actual home coordinate rather than moving outside.
    map.setFilter('buildings', fromApartment
      ? ['all', ['!=', ['get', 'hide_3d'], true], ['>', ['distance', { type: 'Point', coordinates: [props.preferences.window.lon, props.preferences.window.lat] }], 150]]
      : ['!=', ['get', 'hide_3d'], true]);
    if (homeMarker.current) homeMarker.current.getElement().style.display = fromApartment ? 'none' : '';
    if (props.mode === 'window') {
      // While exploring, samples continue updating the same calibrated session.
      // Resume at the present orientation instead of sweeping from an old pose.
      currentLook.current = sighting ? towerAlignmentPose(props.preferences.window) : lookInputRef.current === 'motion' ? lookSession.current.view(performance.now()) : null;
      targetLook.current = currentLook.current;
      applyWindowCamera(map, !currentLook.current, currentLook.current ?? undefined);
      return;
    }
    layerRef.current?.setWindowScaleZoom(null);
    map.setVerticalFieldOfView(36.87); map.setPadding({top:0,bottom:0,left:0,right:0});
  }, [props.mode, props.apartmentView, props.preferences.window, ready, sighting]);

  useEffect(() => {
    if (ready && props.scenicView) applyScenicCamera(props.scenicView);
  }, [ready, props.scenicView, props.approachView?.id, props.preferences.window]);

  useEffect(() => {
    if (lookInput === 'off' || !ready || props.mode !== 'window') return;
    lastFrame.current = performance.now(); lastRender.current = 0;
    const tick = (time: number) => {
      const map = mapRef.current;
      if (map && !sightingRef.current && !document.hidden && lookSession.current.view(time) && currentLook.current && targetLook.current) {
        currentLook.current = smoothView(currentLook.current, targetLook.current, time - lastFrame.current);
        if (time - lastRender.current >= 32) {
          applyWindowCamera(map, false, currentLook.current);
          lastRender.current = time;
        }
      }
      lastFrame.current = time;
      lookFrame.current = requestAnimationFrame(tick);
    };
    lookFrame.current = requestAnimationFrame(tick);
    return () => { if (lookFrame.current !== null) cancelAnimationFrame(lookFrame.current); lookFrame.current = null; };
  }, [lookInput, ready, props.mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || props.mode !== 'follow') return;
    let first = true;
    let initialFlightUntil = 0;
    let frame=0,lastUpdate=0,cameraState:FollowCamera|null=null;
    const transition = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : props.gentleTransitions ? 4200 : 1800;
    const apply=(camera:maplibregl.CameraOptions,elevation:number,time:number)=>{
      if(first){
        map.setCenterElevation(elevation);
        map.flyTo({...camera,duration:transition,essential:false});
        first=false;initialFlightUntil=time+transition;return;
      }
      if(!cameraState){
        const center=map.getCenter();
        cameraState={lon:center.lng,lat:center.lat,zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing(),elevation:map.getCenterElevation()};
      }
      const center=maplibregl.LngLat.convert(camera.center!);
      cameraState=smoothFollowCamera(cameraState,{lon:center.lng,lat:center.lat,zoom:camera.zoom!,pitch:camera.pitch!,bearing:camera.bearing!,elevation},lastUpdate?time-lastUpdate:33);
      map.setCenterElevation(cameraState.elevation);
      map.jumpTo({center:[cameraState.lon,cameraState.lat],zoom:cameraState.zoom,pitch:cameraState.pitch,bearing:cameraState.bearing});
    };
    const follow = (time:number) => {
      frame=requestAnimationFrame(follow);
      if (document.hidden || time < initialFlightUntil){lastUpdate=0;return;}
      if(lastUpdate&&time-lastUpdate<32)return;
      const vessel = latest.current.vessels.find(v => v.id === latest.current.selectedVesselId);
      if (vessel) {
        const p = vesselsRef.current?.getDisplayedPosition(vessel.id) || projectedVessel(vessel, Date.now() + latest.current.clockOffset);
        const behind = destination(p, (p.heading ?? 25) + 155, Math.max(650, (vessel.lengthM ?? 40) * 6));
        const camera = map.calculateCameraOptionsFromTo(new maplibregl.LngLat(behind.lon, behind.lat), Math.max(400, (vessel.lengthM ?? 40) * 3), new maplibregl.LngLat(p.lon, p.lat), 3);
        apply(camera,3,time);lastUpdate=time;
        return;
      }
      const aircraft = latest.current.aircraft.find(a => a.id === latest.current.selectedId);
      if (!aircraft) return;
      const p = layerRef.current?.getDisplayedPosition(aircraft.id) || projectedPosition(aircraft, Date.now() + latest.current.clockOffset);
      const heading = 'heading' in p ? p.heading : aircraft.heading;
      const behind = destination(p, heading + 165, 1700);
      const camera = map.calculateCameraOptionsFromTo(new maplibregl.LngLat(behind.lon, behind.lat), p.altitudeFt * .3048 + 1100, new maplibregl.LngLat(p.lon, p.lat), p.altitudeFt * .3048);
      apply(camera,p.altitudeFt*.3048,time);lastUpdate=time;
    };
    frame=requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [props.mode, props.selectedVesselId || props.selectedId, ready, props.gentleTransitions]);

  return <>
    <div className={`map-canvas ${props.mode === 'window' ? 'window-camera' : ''}`} ref={container} aria-label="Interactive 3D map of Boston Logan and harbor with live aircraft and vessels" />
    {props.mode === 'window' && sighting && <div className="tower-sight" aria-label="Align with Logan control tower">
      <button className="tower-sight-target" onClick={() => void startLook(true)} disabled={!ready} aria-busy={motionStarting} aria-label="Align to Logan control tower" title="Point the iPad at Logan control tower, then tap to align">
        <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="32"/><path d="M50 3v26m0 42v26M3 50h26m42 0h26"/><circle cx="50" cy="50" r="3"/></svg>
      </button>
      <div className="tower-sight-caption"><strong>LOGAN CONTROL TOWER</strong><span>Point the iPad at the real tower.</span><span>Tap the target to align.</span></div>
    </div>}
    {props.mode === 'window' && <div className="look-controls session-controls" aria-label="Window motion controls">
      {!sighting && <button onClick={() => setSighting(true)} title="Show the control tower sight target">Realign to tower</button>}
      {lookMessage && <span className="look-message" role="status">{lookMessage}</span>}
    </div>}
    {!ready && !error && <div className="map-loading"><div className="loading-ring" /><span>BUILDING YOUR AIRSPACE</span></div>}
    {error && <div className="map-error" role="status">{error}<button onClick={() => window.location.reload()}>Reload</button></div>}
    <div className="compass" aria-hidden="true"><span>N</span><div style={{ transform: `rotate(${-bearing}deg)` }}>▲</div></div>
  </>;
});
