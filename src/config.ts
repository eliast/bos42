import type { Preferences } from './types';
export const LOGAN_CENTER: [number, number] = [-71.0096, 42.3656];
// Optional local build defaults. Never put credentials in a client-side file:
// these values are bundled into installed apps even though Git ignores the file.
const localWindows = import.meta.glob<Partial<Preferences['window']>>('./window.local.json', { eager: true, import: 'default' });
const localWindow = Object.values(localWindows)[0] ?? {};
export const DEFAULT_PREFERENCES: Preferences = {
  window: { lat: 42.3656, lon: -71.0096, altitudeM: 165, bearing: 79, zoom: 2.2, tilt: 8, ...localWindow },
  filter: 'airborne', labels: true, trails: true, ground: false, modelScale: 6, aircraftScaleVersion: 2,
  television: false, harbor: true, spotting:true, spottingSound:false,
};
export const EXPLORE_CAMERA = {
  center: [-71.012, 42.359] as [number, number], zoom: 12.95, pitch: 61, bearing: 26,
};
export function loadPreferences(): Preferences {
  try {
    const parsed = JSON.parse(localStorage.getItem('bos42.preferences') || '{}');
    const w = parsed.window || {};
    return {
      ...DEFAULT_PREFERENCES,
      filter: ['airborne', 'arrivals', 'all'].includes(parsed.filter) ? parsed.filter : 'airborne',
      labels: parsed.labels !== false, trails: parsed.trails !== false,
      harbor: parsed.harbor !== false, ground: parsed.ground === true, television: parsed.television === true,
      spotting:parsed.spotting!==false,spottingSound:parsed.spottingSound===true,
      modelScale: parsed.aircraftScaleVersion === 2 && typeof parsed.modelScale === 'number' && Number.isFinite(parsed.modelScale) ? Math.max(1, Math.min(12, parsed.modelScale)) : 6,
      window: { ...DEFAULT_PREFERENCES.window,
        altitudeM: typeof w.altitudeM === 'number' && Number.isFinite(w.altitudeM) ? Math.max(20, Math.min(400, w.altitudeM)) : 165,
        bearing: typeof w.bearing === 'number' && Number.isFinite(w.bearing) ? (!w.zoom && w.bearing === 67 ? 79 : ((w.bearing % 360) + 360) % 360) : 79,
        zoom: typeof w.zoom === 'number' && Number.isFinite(w.zoom) ? Math.max(1, Math.min(3.5, w.zoom)) : 2.2,
        tilt: typeof w.tilt === 'number' && Number.isFinite(w.tilt) ? Math.max(1, Math.min(16, w.tilt)) : 8,
      },
    };
  } catch { return structuredClone(DEFAULT_PREFERENCES); }
}
export function savePreferences(preferences: Preferences) {
  try { localStorage.setItem('bos42.preferences', JSON.stringify(preferences)); } catch { /* Private mode storage can be unavailable. */ }
}
