import * as THREE from 'three';
import { MercatorCoordinate, type Map as LibreMap, type CustomLayerInterface, type CustomRenderMethodInput } from 'maplibre-gl';
import { angleDifference, projectedPosition, FT_METERS } from '../shared/aviation.mjs';
import { LOGAN_CENTER } from './config';
import { classifyFlight } from '../shared/flightGuide.mjs';
import { createAircraftModel, animateAircraftRotors, type AircraftRotor } from './AircraftModels';
import type { Aircraft, Preferences, TrackPoint } from './types';
import { televisionRenderer } from './renderProfile.mjs';
import type {ApproachTrack} from '../shared/approaches.mjs';
import {ApproachTrails} from './ApproachTrails';

function setText(element: HTMLElement, value: string) {
  if (element.textContent !== value) element.textContent = value;
}

interface Entry {
  data: Aircraft; model: THREE.Group; material: THREE.MeshStandardMaterial; rotors:AircraftRotor[];
  label: HTMLButtonElement; code: HTMLElement; detail: HTMLElement; speed: HTMLElement; age: HTMLElement; kind: HTMLElement;
  track: TrackPoint[]; from: THREE.Vector3; blendAt: number;
  screen: { x: number; y: number; visible: boolean };
  labelScreen: { x: number; y: number } | null;
  displayed: { lat: number; lon: number; altitudeFt: number; heading: number } | null;
}

export class AircraftLayer implements CustomLayerInterface {
  id = 'bos42-aircraft';
  type = 'custom' as const;
  renderingMode = '3d' as const;
  private map?: LibreMap;
  private renderer?: THREE.WebGLRenderer;
  private camera = new THREE.Camera();
  private scene = new THREE.Scene();
  private entries = new Map<string, Entry>();
  private orderedEntries: Entry[] = [];
  private labelSizes = new WeakMap<Element, { width: number; height: number }>();
  private labelObserver = new ResizeObserver(entries => {
    // Read after browser layout, never between label writes in the render loop.
    for (const entry of entries) {
      const label = entry.target as HTMLElement;
      if (label.offsetWidth) this.labelSizes.set(label, { width: label.offsetWidth, height: label.offsetHeight });
    }
  });
  private projection = new THREE.Matrix4();
  private projected = new THREE.Vector4();
  private target = new THREE.Vector3();
  private ground = new THREE.Vector3();
  private origin = MercatorCoordinate.fromLngLat(LOGAN_CENTER);
  private metersToWorld = this.origin.meterInMercatorCoordinateUnits();
  private transform = new THREE.Matrix4().makeTranslation(this.origin.x, this.origin.y, 0).scale(new THREE.Vector3(this.metersToWorld, -this.metersToWorld, this.metersToWorld));
  private selected: string | null = null;
  private following = false;
  private windowScaleZoom: number | null = null;
  private preferences: Preferences;
  private labelsRoot: HTMLDivElement;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private hidden = false;
  private lastLabelsAt = 0;
  private lastTrailAt = 0;
  private lastModelFrame=0;
  private approachTrails=new ApproachTrails();
  private onSelect: (id: string) => void;
  private offscreen: HTMLButtonElement;
  private clockOffset = 0;
  private guide = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 25, gapSize: 22, transparent: true, opacity: .6 }));
  private trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .7 }));
  private footprint = new THREE.Mesh(new THREE.RingGeometry(.7, 1, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false }));

  constructor(container: HTMLElement, preferences: Preferences, onSelect: (id: string) => void, onLocate: (id: string) => void) {
    this.preferences = preferences; this.onSelect = onSelect;
    this.labelsRoot = document.createElement('div'); this.labelsRoot.className = 'aircraft-labels';
    this.labelsRoot.setAttribute('aria-label', 'Aircraft in the current view'); container.appendChild(this.labelsRoot);
    this.offscreen = document.createElement('button'); this.offscreen.className = 'offscreen-flight'; this.offscreen.hidden = true;
    this.offscreen.addEventListener('pointerdown', event => event.stopPropagation());
    this.offscreen.addEventListener('click', event => {event.stopPropagation(); if (this.selected) onLocate(this.selected);});
    this.labelsRoot.appendChild(this.offscreen);
    this.scene.add(new THREE.AmbientLight('#ffffff', 1.9));
    const key = new THREE.DirectionalLight('#fff4da', 2.5); key.position.set(-100, -50, 150); this.scene.add(key);
    const rim = new THREE.DirectionalLight('#8cd0ec', 1.5); rim.position.set(50, 100, 20); this.scene.add(rim);
    this.guide.visible = false; this.trail.visible = false; this.footprint.visible = false;
    this.trail.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(72 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.trail.geometry.setDrawRange(0, 0);
    this.trail.frustumCulled = false;
    this.guide.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage));
    this.guide.geometry.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(2), 1).setUsage(THREE.DynamicDrawUsage));
    this.guide.frustumCulled = false;
    this.approachTrails.frustumCulled=false;
    this.scene.add(this.guide, this.trail, this.footprint,this.approachTrails);
  }
  onAdd(map: LibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl as WebGL2RenderingContext, antialias: !televisionRenderer });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  private toScene(lon: number, lat: number, altitudeFt: number, result = new THREE.Vector3()) {
    const p = MercatorCoordinate.fromLngLat([lon, lat], altitudeFt * FT_METERS);
    return result.set((p.x - this.origin.x) / this.metersToWorld, -(p.y - this.origin.y) / this.metersToWorld, p.z / this.metersToWorld);
  }
  update(aircraft: Aircraft[], clockOffset: number) {
    if (this.disposed) return;
    this.clockOffset = clockOffset;
    const seen = new Set<string>();
    for (const data of aircraft) {
      seen.add(data.id);
      let entry = this.entries.get(data.id);
      // A backup feed can briefly return an older position. Keep the current
      // model instead of reversing to that report without a correction blend.
      if(entry && data.observedAt < entry.data.observedAt)continue;
      if (!entry) {
        const { group, material, rotors } = createAircraftModel(data.color, data.aircraftType, televisionRenderer);
        const label = document.createElement('button'); label.className = 'aircraft-label'; label.type = 'button'; label.hidden = true;
        const code = document.createElement('strong'), detail = document.createElement('span'), speed = document.createElement('span'), age = document.createElement('small'), kind = document.createElement('small');
        detail.className = 'aircraft-altitude'; speed.className = 'aircraft-speed'; age.className = 'aircraft-age'; kind.className = 'aircraft-kind'; label.append(kind, code, detail, speed, age);
        label.addEventListener('click', event => { event.stopPropagation(); this.onSelect(data.id); });
        label.addEventListener('pointerdown', event => event.stopPropagation());
        this.labelsRoot.appendChild(label); this.scene.add(group);
        const pos = projectedPosition(data, Date.now() + this.clockOffset); group.position.copy(this.toScene(pos.lon, pos.lat, pos.altitudeFt)); group.rotation.z = -data.heading * Math.PI / 180;
        entry = { data, model: group, material, rotors, label, code, detail, speed, age, kind, track: [], from: new THREE.Vector3(), blendAt: performance.now() - 2000, screen: { x: 0, y: 0, visible: false }, labelScreen: null, displayed: null };
        this.entries.set(data.id, entry);
        this.labelObserver.observe(label);
      } else if (data.observedAt > entry.data.observedAt) {
        // Store the correction between the currently displayed model and the
        // new report's prediction. Decay that correction while the prediction
        // keeps moving; restarting a fixed-position lerp froze each plane at
        // the start of every fresh report.
        const p = projectedPosition(data, Date.now() + this.clockOffset);
        entry.from.copy(entry.model.position).sub(this.toScene(p.lon, p.lat, p.altitudeFt));
        entry.blendAt = performance.now();
      }
      if (!entry.track.length || data.observedAt > entry.track[entry.track.length - 1].at + 1000) {
        entry.track.push({ lat: data.lat, lon: data.lon, altitudeFt: data.altitudeFt, at: data.observedAt });
        entry.track = entry.track.filter(p => p.at > data.observedAt - 300000).slice(-70);
      }
      entry.data = data; entry.material.color.set(data.color);
      entry.code.textContent = data.label;
      const classification = classifyFlight(data);
      entry.label.dataset.kind = classification.kind;
      entry.kind.textContent = classification.shortLabel;
      entry.kind.hidden = !['private', 'cargo', 'business'].includes(classification.kind);
      entry.label.style.setProperty('--plane-color', data.color);
      const altitude = data.ground ? 'on ground' : Number.isFinite(data.altitudeFt) ? `${Math.round(data.altitudeFt).toLocaleString()} feet ${data.altitudeSource === 'barometric' ? 'barometric' : 'above mean sea level'}` : 'altitude unavailable';
      const speed = Number.isFinite(data.speedKts) && data.speedKts > 0 ? `, ${Math.round(data.speedKts)} knots groundspeed` : '';
      entry.label.setAttribute('aria-label', `${data.operator} ${data.label}, ${classification.label}, ${altitude}${speed}`);
    }
    for (const [id, entry] of this.entries) if (!seen.has(id)) this.removeEntry(id, entry);
    this.sortEntries();
    this.map?.triggerRepaint();
  }
  setSelection(id: string | null) {
    this.selected = id; this.lastTrailAt = 0;
    this.sortEntries();
    this.entries.forEach((entry, key) => { entry.label.classList.toggle('selected', key === id); entry.label.setAttribute('aria-pressed', String(key === id)); });
    this.map?.triggerRepaint();
  }
  setFollowing(value: boolean) { this.following = value; this.map?.triggerRepaint(); }
  setApproachTrails(tracks:ApproachTrack[],now:number){
    this.approachTrails.setTracks(tracks,now,p=>this.toScene(p.lon,p.lat,Math.max(26,p.altitudeFt)));
    this.map?.triggerRepaint();
  }
  setWindowScaleZoom(zoom: number | null) { this.windowScaleZoom = zoom; }
  setPreferences(preferences: Preferences) { this.preferences = preferences; this.map?.triggerRepaint(); }
  setPaused(value: boolean) { this.hidden = value; if (!value) this.map?.triggerRepaint(); }
  getDisplayedPosition(id: string) { return this.entries.get(id)?.displayed || null; }
  pick(x: number, y: number): string | null {
    const candidate = [...this.entries.values()].filter(e => e.screen.visible && e.model.visible).map(e => ({ id: e.data.id, distance: Math.hypot(e.screen.x - x, e.screen.y - y) })).filter(e => e.distance < 28).sort((a, b) => a.distance - b.distance)[0];
    return candidate?.id || null;
  }
  private sortEntries() {
    this.orderedEntries = [...this.entries.values()].sort((a, b) => a.data.id === this.selected ? -1 : b.data.id === this.selected ? 1 : a.data.distanceNm - b.data.distanceNm);
  }
  private removeEntry(id: string, entry: Entry) { this.labelObserver.unobserve(entry.label); entry.label.remove(); this.scene.remove(entry.model); entry.material.dispose(); this.entries.delete(id); }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.renderer || !this.map || this.disposed) return;
    const now = Date.now() + this.clockOffset, perf = performance.now();
    const modelDelta=this.lastModelFrame?Math.min(100,Math.max(0,perf-this.lastModelFrame)):33;
    this.lastModelFrame=perf;
    const { width, height } = this.map.getCanvas().getBoundingClientRect();
    this.approachTrails.setViewport(width,height);
    const visibleHeight = Math.min(height, this.map.getContainer().parentElement?.clientHeight || height);
    const matrix = this.projection.fromArray(args.defaultProjectionData.mainMatrix);
    this.camera.projectionMatrix.copy(matrix.multiply(this.transform));
    // MapLibre changes its ground-target zoom when a fixed camera tilts.
    // Window uses one reference size so looking up/down cannot resize models.
    const scaleZoom = this.windowScaleZoom ?? this.map.getZoom();
    const scale = Math.min(230, Math.max(17, 38 * 2 ** (14 - scaleZoom))) * this.preferences.modelScale;
    // Keep label movement at the model's repaint cadence. The old 90 ms gate
    // made smoothly moving aircraft appear to drag a label in visible steps.
    const labelDelta = perf - this.lastLabelsAt;
    const updateLabels = labelDelta > 30;
    if (updateLabels) { this.lastLabelsAt = perf; this.offscreen.hidden = true; }
    const occupied: { x: number; y: number }[] = [];
    let labelCount = 0;
    for (const entry of this.orderedEntries) {
      const p = projectedPosition(entry.data, now);
      const target = this.toScene(p.lon, p.lat, p.altitudeFt, this.target);
      const alpha = Math.min(1, (perf - entry.blendAt) / 1600);
      const smooth = alpha * alpha * (3 - 2 * alpha);
      entry.model.position.copy(target).addScaledVector(entry.from, 1 - smooth);
      if(entry.data.headingKnown!==false && Number.isFinite(entry.data.heading)){
        const targetAngle = -entry.data.heading * Math.PI / 180;
        const delta = angleDifference(targetAngle * 180 / Math.PI, entry.model.rotation.z * 180 / Math.PI) * Math.PI / 180;
        entry.model.rotation.z += delta * (1-Math.exp(-modelDelta/220));
      }
      const world = entry.model.position;
      const geo = new MercatorCoordinate(this.origin.x + world.x * this.metersToWorld, this.origin.y - world.y * this.metersToWorld, world.z * this.metersToWorld);
      const lngLat = geo.toLngLat();
      entry.displayed = { lat: lngLat.lat, lon: lngLat.lng, altitudeFt: geo.toAltitude() / FT_METERS, heading: ((-entry.model.rotation.z * 180 / Math.PI) % 360 + 360) % 360 };
      const selected = entry.data.id === this.selected;
      entry.code.hidden = selected && this.following;
      const visible = p.ageSeconds <= 90 && (!entry.data.ground || this.preferences.ground || selected) && (this.preferences.filter !== 'arrivals' || entry.data.phase === 'Likely arrival' || selected);
      entry.model.visible = visible;
      if (visible && !entry.data.ground && p.ageSeconds <= 20 && entry.rotors.length) animateAircraftRotors(entry.rotors,perf / 1000);
      entry.model.scale.setScalar(scale * (selected ? 1.26 : entry.data.ground ? .52 : .9));
      entry.material.transparent = p.ageSeconds > 20; entry.material.opacity = p.ageSeconds > 20 ? .4 : 1;
      if (updateLabels) {
        const v = this.projected.set(entry.model.position.x, entry.model.position.y, entry.model.position.z, 1).applyMatrix4(this.camera.projectionMatrix);
        const x = (v.x / v.w + 1) * width / 2, y = (1 - v.y / v.w) * height / 2;
        const onscreen = visible && v.w > 0 && v.z / v.w > -1 && v.z / v.w < 1 && x > 20 && x < width - 20 && y > 80 && y < visibleHeight - 45;
        entry.screen = { x, y, visible: onscreen };
        if (selected && visible && !onscreen) {
          const behind = v.w <= 0 || !Number.isFinite(x) || !Number.isFinite(y);
          const direction = behind ? 'BEHIND VIEW' : x < 20 ? 'LEFT OF VIEW' : x > width - 20 ? 'RIGHT OF VIEW' : y < 80 ? 'ABOVE VIEW' : 'BELOW VIEW';
          const arrow = behind ? '↶' : x < 20 ? '←' : x > width - 20 ? '→' : y < 80 ? '↑' : '↓';
          this.offscreen.textContent = `${arrow} ${entry.data.label} · ${direction}`;
          this.offscreen.setAttribute('aria-label', `Find ${entry.data.label}, ${direction.toLowerCase()}`);
          this.offscreen.style.setProperty('--plane-color', entry.data.color);
          this.offscreen.style.left = x > width - 20 && !behind ? 'auto' : '22px';
          this.offscreen.style.right = x > width - 20 && !behind ? '76px' : 'auto';
          this.offscreen.style.top = `${behind ? Math.max(160, visibleHeight * .5) : Math.max(160, Math.min(visibleHeight - 108, y))}px`;
          this.offscreen.hidden = false;
        }
        // A visible label gets a small overlap allowance, so two aircraft
        // near the threshold do not make their labels blink on each frame.
        const wasHidden = entry.label.hidden;
        const noCollision = selected || occupied.every(p => Math.abs(p.x - x) > (wasHidden ? 180 : 160) || Math.abs(p.y - y) > (wasHidden ? 90 : 74));
        const showLabel = onscreen && !(selected && this.following) && (selected || this.preferences.labels && noCollision && labelCount < (width < 600 ? 5 : 12));
        entry.label.hidden = !showLabel;
        if (showLabel) {
          const projection = this.camera.projectionMatrix.elements;
          const modelRadius = entry.model.scale.x * .85;
          const screenRadius = modelRadius * Math.hypot(projection[1], projection[5], projection[9]) / v.w * height / 2;
          const clearance = Math.max(17, screenRadius + 8);
          const size = this.labelSizes.get(entry.label) ?? { width: 180, height: 64 };
          const placeBelow = y - clearance - size.height < 150;
          const labelY = placeBelow ? y + clearance : y - clearance;
          const halfWidth = size.width / 2;
          const target = { x: Math.max(halfWidth + 8, Math.min(width - halfWidth - 8, x)), y: labelY };
          if (!entry.labelScreen || wasHidden) entry.labelScreen = target;
          else {
            const fraction = 1 - Math.exp(-labelDelta / 55);
            entry.labelScreen.x += (target.x - entry.labelScreen.x) * fraction;
            entry.labelScreen.y += (labelY - entry.labelScreen.y) * fraction;
            // A camera gesture or a corrected report can move the model fast;
            // cap the visual separation instead of leaving the tag behind.
            entry.labelScreen.x = Math.max(target.x - 16, Math.min(target.x + 16, entry.labelScreen.x));
            entry.labelScreen.y = Math.max(labelY - 16, Math.min(labelY + 16, entry.labelScreen.y));
          }
          entry.label.style.transform = `translate(${entry.labelScreen.x.toFixed(1)}px, ${entry.labelScreen.y.toFixed(1)}px) translate(-50%, ${placeBelow ? '0' : '-100%'})`;
          setText(entry.detail, entry.data.ground ? 'GROUND' : Number.isFinite(entry.data.altitudeFt) ? `${(Math.round(entry.data.altitudeFt / 25) * 25).toLocaleString()} FT ${entry.data.altitudeSource === 'barometric' ? 'BARO' : 'MSL'}` : 'ALT UNAVAILABLE');
          setText(entry.speed, Number.isFinite(entry.data.speedKts) && entry.data.speedKts > 0 ? `${Math.round(entry.data.speedKts)} KT GROUND SPEED` : '');
          entry.speed.hidden = !entry.speed.textContent;
          setText(entry.age, p.ageSeconds > 20 ? `${Math.floor(p.ageSeconds)}s OLD · POSITION HELD` : '');
          entry.age.hidden = !entry.age.textContent;
          entry.label.classList.toggle('stale', p.ageSeconds > 20); occupied.push({ x, y }); labelCount++;
        } else entry.labelScreen = null;
      }
    }
    const selected = this.selected ? this.entries.get(this.selected) : null;
    this.guide.visible = !!selected?.model.visible;
    this.footprint.visible = this.guide.visible;
    if (selected && this.guide.visible) {
      const point = selected.model.position, ground = this.ground.set(point.x, point.y, 7);
      const guidePositions = this.guide.geometry.getAttribute('position') as THREE.BufferAttribute;
      guidePositions.setXYZ(0, ground.x, ground.y, ground.z); guidePositions.setXYZ(1, point.x, point.y, point.z); guidePositions.needsUpdate = true;
      const distances = this.guide.geometry.getAttribute('lineDistance') as THREE.BufferAttribute;
      distances.setX(1, ground.distanceTo(point)); distances.needsUpdate = true;
      (this.guide.material as THREE.LineDashedMaterial).color.set(selected.data.color);
      this.footprint.position.copy(ground); this.footprint.scale.setScalar(scale * .65); (this.footprint.material as THREE.MeshBasicMaterial).color.set(selected.data.color);
      if (perf - this.lastTrailAt > 300) {
        this.lastTrailAt = perf;
        const points = selected.track.map(p => this.toScene(p.lon, p.lat, p.altitudeFt)); points.push(point.clone());
        const positions = this.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
        points.forEach((p, index) => positions.setXYZ(index, p.x, p.y, Math.max(7, p.z)));
        positions.needsUpdate = true; this.trail.geometry.setDrawRange(0, points.length);
        (this.trail.material as THREE.LineBasicMaterial).color.set(selected.data.color);
      }
      this.trail.visible = this.preferences.trails && selected.track.length > 1;
    } else this.trail.visible = false;
    this.renderer.resetState(); this.renderer.render(this.scene, this.camera); this.renderer.resetState();
    // Include render cost in the frame budget instead of adding 33 ms after it.
    if (!this.hidden && !document.hidden && !this.timer) this.timer = setTimeout(() => { this.timer = undefined; if (!this.disposed) this.map?.triggerRepaint(); }, Math.max(0, 1000 / 30 - (performance.now() - perf)));
  }
  onRemove() { this.dispose(); }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    clearTimeout(this.timer); this.labelObserver.disconnect(); this.labelsRoot.remove();
    this.entries.forEach((entry, id) => this.removeEntry(id, entry));
    this.guide.geometry.dispose(); (this.guide.material as THREE.Material).dispose();
    this.trail.geometry.dispose(); (this.trail.material as THREE.Material).dispose();
    this.approachTrails.dispose();
    this.footprint.geometry.dispose(); (this.footprint.material as THREE.Material).dispose();
    this.renderer?.dispose();
  }
}
