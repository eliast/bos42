export type FeedStatus = 'connecting' | 'live' | 'stale' | 'unavailable' | 'demo';
export type CameraMode = 'window' | 'explore' | 'follow';
export type FilterMode = 'airborne' | 'arrivals' | 'all';
export interface Aircraft {
  id: string; callsign: string; label: string; registration: string | null;
  aircraftType: string | null; lat: number; lon: number; altitudeFt: number;
  altitudeSource: 'ground' | 'geometric' | 'barometric';
  barometricAltitudeFt: number | null; geometricAltitudeFt: number | null; geoidOffsetM: number; ground: boolean; speedKts: number;
  heading: number; headingKnown: boolean; verticalRateFpm: number;
  speedKnown?: boolean; verticalRateKnown?: boolean;
  observedAt: number; receivedAt: number; identityObservedAt: number | null; positionAgeSeconds: number;
  source: string; operator: string; color: string; distanceNm: number; phase: string;
}
export interface Feed {
  aircraft: Aircraft[]; status: FeedStatus; fetchedAt: number | null;
  sourceTime: number | null; serverTime: number; provider: string | null;
  providerName: string | null; attribution: string | null;
  ageSeconds: number | null; error: string | null; retryAfterMs: number; radiusNm: number;
}
export interface Airport {
  name: string; municipality: string; iata: string | null; icao: string | null;
  country: string; lat: number; lon: number;
}
export interface Route {
  callsign: string; flightNumber: string | null; airline: string | null;
  origin: Airport | null; destination: Airport | null; via: Airport | null;
  retrievedAt: number;
}
export interface RouteResult { route: Route | null; status: string; source: string; }
export interface WindowView { lat: number; lon: number; altitudeM: number; bearing: number; zoom: number; tilt: number; }
export interface Preferences {
  window: WindowView; filter: FilterMode; labels: boolean; trails: boolean;
  ground: boolean; harbor: boolean; modelScale: number; aircraftScaleVersion: number; television: boolean;
  spotting: boolean; spottingSound: boolean;
}
export interface TrackPoint { lat: number; lon: number; altitudeFt: number; at: number; }
