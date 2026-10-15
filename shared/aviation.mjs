export const LOGAN = { lat: 42.3656, lon: -71.0096, elevationFt: 20 };
export const NM_METERS = 1852;
export const FT_METERS = 0.3048;
export const EARTH_RADIUS_M = 6371008.8;
const radians = degrees => degrees * Math.PI / 180;
const degrees = r => r * 180 / Math.PI;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = v => typeof v === 'number' && Number.isFinite(v) ? v : null;

export function distanceNm(a, b) {
  const dLat = radians(b.lat - a.lat), dLon = radians(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h))) / NM_METERS;
}
export function bearing(a, b) {
  const p1 = radians(a.lat), p2 = radians(b.lat), d = radians(b.lon - a.lon);
  return (degrees(Math.atan2(Math.sin(d) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(d))) + 360) % 360;
}
export function angleDifference(a, b) { return ((a - b + 540) % 360) - 180; }
export function destination(start, heading, meters) {
  const d = meters / EARTH_RADIUS_M, h = radians(heading), p = radians(start.lat), l = radians(start.lon);
  const p2 = Math.asin(Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(h));
  const l2 = l + Math.atan2(Math.sin(h) * Math.sin(d) * Math.cos(p), Math.cos(d) - Math.sin(p) * Math.sin(p2));
  return { lat: degrees(p2), lon: ((degrees(l2) + 540) % 360) - 180 };
}

// Brand colors are display accents; callsign prefixes identify the operating airline,
// not necessarily the marketed codeshare. Unknown operators remain neutral.
export const AIRLINES = {
  NKS: { name: 'Spirit', iata: 'NK', color: '#FFE000' },
  JBU: { name: 'JetBlue', iata: 'B6', color: '#003876' },
  DAL: { name: 'Delta', iata: 'DL', color: '#C8102E' },
  AAL: { name: 'American', iata: 'AA', color: '#0078D2' },
  UAL: { name: 'United', iata: 'UA', color: '#005DAA' },
  SWA: { name: 'Southwest', iata: 'WN', color: '#304CB2' },
  FFT: { name: 'Frontier', iata: 'F9', color: '#248168' },
  AAY: { name: 'Allegiant', iata: 'G4', color: '#F59C22' },
  SCX: { name: 'Sun Country', iata: 'SY', color: '#F58220' },
  POE: { name: 'Porter', iata: 'PD', color: '#163C53' },
  MXY: { name: 'Breeze', iata: 'MX', color: '#00A5B5' },
  WJA: { name: 'WestJet', iata: 'WS', color: '#00857D' },
  JZA: { name: 'Jazz', iata: 'QK', color: '#E31937' },
  ASA: { name: 'Alaska', iata: 'AS', color: '#007E8A' },
  BAW: { name: 'British Airways', iata: 'BA', color: '#075AAA' },
  VIR: { name: 'Virgin Atlantic', iata: 'VS', color: '#DA0530' },
  AFR: { name: 'Air France', iata: 'AF', color: '#002157' },
  KLM: { name: 'KLM', iata: 'KL', color: '#00A1DE' },
  DLH: { name: 'Lufthansa', iata: 'LH', color: '#F9BA00' },
  SWR: { name: 'Swiss', iata: 'LX', color: '#E4002B' },
  EIN: { name: 'Aer Lingus', iata: 'EI', color: '#008578' },
  ICE: { name: 'Icelandair', iata: 'FI', color: '#F7C900' },
  ACA: { name: 'Air Canada', iata: 'AC', color: '#F01428' },
  UAE: { name: 'Emirates', iata: 'EK', color: '#D71920' },
  QTR: { name: 'Qatar Airways', iata: 'QR', color: '#8E2157' },
  THY: { name: 'Turkish Airlines', iata: 'TK', color: '#E81932' },
  TAP: { name: 'TAP Air Portugal', iata: 'TP', color: '#84BD00' },
  IBE: { name: 'Iberia', iata: 'IB', color: '#D71920' },
  JAL: { name: 'Japan Airlines', iata: 'JL', color: '#C8102E' },
  KAL: { name: 'Korean Air', iata: 'KE', color: '#5CACE8' },
  SIA: { name: 'Singapore Airlines', iata: 'SQ', color: '#D6A23D' },
  SAS: { name: 'SAS', iata: 'SK', color: '#000099' },
  RZO: { name: 'Azores Airlines', iata: 'S4', color: '#85B927' },
  WZZ: { name: 'Wizz Air', iata: 'W6', color: '#C6007E' },
  AUA: { name: 'Austrian', iata: 'OS', color: '#D81E05' },
  ELY: { name: 'El Al', iata: 'LY', color: '#063B80' },
  HAL: { name: 'Hawaiian', iata: 'HA', color: '#7B2582' },
  KAP: { name: 'Cape Air', iata: '9K', color: '#3298C5' },
  RPA: { name: 'Republic Airways', iata: 'YX', color: '#8C9EAE' },
  EDV: { name: 'Endeavor Air', iata: '9E', color: '#AF1E2D' },
  SKW: { name: 'SkyWest', iata: 'OO', color: '#547EAF' },
  ENY: { name: 'Envoy', iata: 'MQ', color: '#1293D1' },
  FDX: { name: 'FedEx', iata: 'FX', color: '#7223B9' },
  UPS: { name: 'UPS', iata: '5X', color: '#C49A6C' },
  // Neutral display accents until a brand color is curated for these operators.
  EJA: { name: 'NetJets', iata: '', color: '#C8D1D7' },
  LXJ: { name: 'Flexjet', iata: '', color: '#C8D1D7' },
  ABX: { name: 'ABX Air', iata: 'GB', color: '#C8D1D7' },
  ATN: { name: 'Air Transport International', iata: '8C', color: '#C8D1D7' },
  GTI: { name: 'Atlas Air', iata: '5Y', color: '#C8D1D7' },
};
export function airlineFor(callsign = '') {
  const prefix = callsign.trim().slice(0, 3).toUpperCase();
  return AIRLINES[prefix] || { name: 'Other aircraft', iata: '', color: '#C8D1D7' };
}
export function flightLabel(callsign = '', fallback = '') {
  const cleaned = callsign.trim().toUpperCase();
  const airline = airlineFor(cleaned);
  return airline.iata && /^\d/.test(cleaned.slice(3)) ? `${airline.iata}${cleaned.slice(3)}` : cleaned || fallback;
}
export function normalizeAircraft(raw, sourceTime, receivedAt = Date.now(), geoidOffsetM = 0) {
  if (!raw || finite(raw.lat) === null || finite(raw.lon) === null || Math.abs(raw.lat) > 90 || Math.abs(raw.lon) > 180) return null;
  const id = String(raw.hex || '').toLowerCase();
  if (!/^~?[0-9a-f]{6}$/.test(id)) return null;
  // Surface vehicles and static obstacles are not airplanes.
  if (['C1', 'C2', 'C3', 'C4', 'C5'].includes(String(raw.category || ''))) return null;
  const positionAge = Math.max(0, finite(raw.seen_pos) ?? finite(raw.seen) ?? 0);
  if (positionAge > 120) return null;
  const ground = raw.alt_baro === 'ground';
  const barometricAltitude = finite(raw.alt_baro), geometricAltitude = finite(raw.alt_geom);
  const altitudeFt = ground ? LOGAN.elevationFt : geometricAltitude !== null ? geometricAltitude - geoidOffsetM / FT_METERS : barometricAltitude;
  if (!ground && altitudeFt === null) return null;
  const callsign = String(raw.flight || '').trim().toUpperCase();
  const operator = airlineFor(callsign);
  const observedAt = Math.min(receivedAt, sourceTime) - positionAge * 1000;
  const aircraft = {
    id, callsign, label: flightLabel(callsign, raw.r || id.toUpperCase()),
    registration: raw.r || null, aircraftType: raw.t || null,
    lat: raw.lat, lon: raw.lon, altitudeFt: altitudeFt ?? LOGAN.elevationFt,
    altitudeSource: ground ? 'ground' : geometricAltitude !== null ? 'geometric' : 'barometric',
    barometricAltitudeFt: barometricAltitude, geometricAltitudeFt: geometricAltitude, geoidOffsetM, ground,
    speedKts: Math.max(0, finite(raw.gs) ?? 0),
    speedKnown: finite(raw.gs) !== null && raw.gs >= 0,
    heading: finite(raw.track) ?? finite(raw.true_heading) ?? finite(raw.mag_heading) ?? 0,
    // Ground track describes movement. A heading alone describes orientation,
    // so it must not drive a projected path (wind can make those differ).
    headingKnown: finite(raw.track) !== null,
    verticalRateFpm: finite(raw.geom_rate) ?? finite(raw.baro_rate) ?? 0,
    verticalRateKnown: finite(raw.geom_rate) !== null || finite(raw.baro_rate) !== null,
    observedAt, receivedAt, identityObservedAt: callsign ? receivedAt : null, positionAgeSeconds: (receivedAt - observedAt) / 1000,
    source: raw.type || 'adsb', operator: operator.name, color: operator.color,
    distanceNm: distanceNm({ lat: raw.lat, lon: raw.lon }, LOGAN),
  };
  return { ...aircraft, phase: inferPhase(aircraft) };
}
export function inferPhase(aircraft) {
  if (aircraft.ground) return aircraft.speedKts > 4 ? 'Taxiing' : 'On ground';
  if (aircraft.distanceNm < 12 && aircraft.altitudeFt < 5000 && aircraft.verticalRateFpm > 350) return 'Climbing';
  const towards = Math.abs(angleDifference(aircraft.heading, bearing(aircraft, LOGAN))) < 55;
  const approachHeight = aircraft.altitudeFt >= Math.max(0, (aircraft.distanceNm - 3) * 140);
  if (aircraft.headingKnown !== false && aircraft.distanceNm < 15 && aircraft.altitudeFt < 6500 && approachHeight && aircraft.verticalRateFpm < -150 && towards) return 'Likely arrival';
  if (aircraft.verticalRateFpm < -250) return 'Descending';
  if (aircraft.verticalRateFpm > 350) return 'Climbing';
  return 'Airborne';
}
export function sourceTimestamp(body, fallback) {
  const raw = finite(body.now) ?? finite(body.ctime) ?? finite(body.timestamp);
  if (raw === null) return fallback;
  return raw < 1e12 ? raw * 1000 : raw;
}
export function normalizeFeed(body, receivedAt = Date.now(), geoidHeight = (_lat, _lon) => 0) {
  const rows = body.ac ?? body.aircraft;
  if (!Array.isArray(rows)) throw new Error('Feed response did not contain an aircraft array');
  const sourceTime = sourceTimestamp(body, receivedAt);
  if (sourceTime > receivedAt + 60000 || sourceTime < receivedAt - 600000) throw new Error('Feed timestamp is outside the live window');
  const aircraft = rows.map(raw => normalizeAircraft(raw, sourceTime, receivedAt, Number.isFinite(raw?.lat) && Math.abs(raw.lat) <= 90 && Number.isFinite(raw?.lon) && Math.abs(raw.lon) <= 180 ? geoidHeight(raw.lat, raw.lon) : 0)).filter(Boolean);
  return { aircraft, sourceTime, fetchedAt: receivedAt };
}
// Extrapolation is bounded. Once a position grows old, freeze it rather than
// inventing an aircraft's continuing path through turns or missed updates.
export function projectedPosition(aircraft, now = Date.now(), maxSeconds = 8) {
  const age = Math.max(0, (now - aircraft.observedAt) / 1000);
  const seconds = Math.min(age, maxSeconds);
  const moved = aircraft.headingKnown === false ? { lat: aircraft.lat, lon: aircraft.lon } : destination(aircraft, aircraft.heading, aircraft.speedKts * NM_METERS / 3600 * seconds);
  return { ...moved, altitudeFt: aircraft.ground ? LOGAN.elevationFt : Math.max(LOGAN.elevationFt, aircraft.altitudeFt + aircraft.verticalRateFpm * seconds / 60), ageSeconds: age, frozen: age > maxSeconds };
}

// A callsign database is not a live schedule. Suppress clearly incompatible
// routes near Logan rather than attaching a previous use of the flight number.
export function routeFitsAircraft(route, aircraft) {
  if (!route || !aircraft || !route.origin || !route.destination) return false;
  if (String(route.callsign).toUpperCase() !== aircraft.callsign) return false;
  const isLogan = airport => airport?.icao === 'KBOS' || airport?.iata === 'BOS';
  if (aircraft.distanceNm < 12 && aircraft.altitudeFt < 6500) {
    if (aircraft.phase === 'Likely arrival' && !isLogan(route.destination)) return false;
    if (aircraft.phase === 'Climbing' && !isLogan(route.origin)) return false;
    if (![route.origin, route.destination, route.via].some(isLogan)) return false;
  }
  return true;
}
