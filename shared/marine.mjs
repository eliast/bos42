// AISStream decoded message fields: https://aisstream.io/documentation/
// AIS units and unavailable sentinels: https://www.navcen.uscg.gov/ais-class-a-reports
export const HARBOR_BOUNDS = { south: 42.25, west: -71.13, north: 42.45, east: -70.85 };
export const VESSEL_EXPIRY_MS = 15 * 60_000;
export const AIS_TYPES = ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport', 'ShipStaticData', 'StaticDataReport'];
const POSITION_TYPES = new Set(AIS_TYPES.slice(0, 3));
const numberIn = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : null;
const text = value => typeof value === 'string' ? value.replace(/@/g, '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 80) || null : null;

export function vesselKind(type) {
  if (type >= 60 && type <= 69) return { label: 'Passenger vessel', color: '#68cabb', kind: 'passenger' };
  if (type >= 70 && type <= 79) return { label: 'Cargo ship', color: '#e1b96e', kind: 'cargo' };
  if (type >= 80 && type <= 89) return { label: 'Tanker', color: '#d48f79', kind: 'tanker' };
  if ([31, 32, 52].includes(type)) return { label: type === 52 ? 'Tug' : 'Towing vessel', color: '#e9a46c', kind: 'tug' };
  if (type === 36) return { label: 'Sailing vessel', color: '#d6e3ee', kind: 'sail' };
  if (type === 37) return { label: 'Pleasure craft', color: '#b7a2d6', kind: 'pleasure' };
  if (type === 30) return { label: 'Fishing vessel', color: '#91bb86', kind: 'fishing' };
  if ([50, 51, 53, 54, 55, 58].includes(type)) return { label: ({50:'Pilot vessel',51:'Search and rescue',53:'Port tender',54:'Anti-pollution vessel',55:'Law enforcement',58:'Medical transport'})[type], color: '#84bedb', kind: 'service' };
  if (type >= 40 && type <= 49) return { label: 'High-speed craft', color: '#68cabb', kind: 'passenger' };
  return { label: 'Vessel', color: '#9fb8c3', kind: 'unknown' };
}

export function navigationLabel(status) {
  return ({0:'Underway · engine',1:'At anchor',2:'Not under command',3:'Restricted maneuverability',4:'Constrained by draft',5:'Moored',6:'Aground',7:'Fishing',8:'Underway · sailing',11:'Towing astern',12:'Pushing or towing alongside',14:'AIS distress signal'})[status] ?? null;
}

export function aisTime(value) {
  if (typeof value !== 'string') return null;
  // Go UTC timestamps contain nanoseconds and a zone suffix; Date.parse does not.
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))? \+0000 UTC$/);
  const date = Date.parse(match ? `${match[1]}T${match[2]}.${(match[3] || '').padEnd(3, '0').slice(0, 3)}Z` : value);
  return Number.isFinite(date) ? date : null;
}

function dimensions(value) {
  const sum = (a, b, max) => numberIn(a, 0, max) !== null && numberIn(b, 0, max) !== null && a + b > 0 ? a + b : null;
  return { lengthM: sum(value?.A, value?.B, 511), widthM: sum(value?.C, value?.D, 63) };
}
function reportedEta(value) {
  if (!value || ![value.Month, value.Day, value.Hour, value.Minute].every(Number.isInteger)) return null;
  const { Month: month, Day: day, Hour: hour, Minute: minute } = value;
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(2000, month, 0)).getUTCDate() || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { month, day, hour, minute }; // AIS has no year; do not fabricate one.
}
export function vesselStaleAfter(vessel) {
  return [1, 5].includes(vessel.navigationStatus) || vessel.speedKts !== null && vessel.speedKts < .5 ? 5 * 60_000 : 60_000;
}

export function mergeVessel(previous, event, now) {
  const type = event?.MessageType, data = event?.Message?.[type];
  if (!AIS_TYPES.includes(type) || !data || data.Valid !== true) return previous;
  const mmsi = String(data.UserID ?? '');
  if (!/^[1-9]\d{8}$/.test(mmsi) || event.MetaData?.MMSI && String(event.MetaData.MMSI) !== mmsi) return previous;
  const at = aisTime(event.MetaData?.time_utc);
  if (at === null || at > now + 10_000 || now - at > 24 * 60 * 60_000) return previous;
  const vessel = previous ? { ...previous } : { id: mmsi, mmsi, name: null, callsign: null, imo: null, shipType: null, destination: null, eta: null, draftM: null, lengthM: null, widthM: null, lat: null, lon: null, speedKts: null, course: null, heading: null, navigationStatus: null, observedAt: null, detailsReportedAt: null, updatedAt: at };
  vessel.updatedAt = Math.max(vessel.updatedAt, at);
  const name = text(event.MetaData?.ShipName);
  if (name && !vessel.name) vessel.name = name;
  if (POSITION_TYPES.has(type) && now - at <= VESSEL_EXPIRY_MS && (vessel.observedAt === null || at >= vessel.observedAt)) {
    const lat = numberIn(data.Latitude, -90, 90), lon = numberIn(data.Longitude, -180, 180);
    if (lat === null || lon === null) return previous;
    const inBounds = lat >= HARBOR_BOUNDS.south && lat <= HARBOR_BOUNDS.north && lon >= HARBOR_BOUNDS.west && lon <= HARBOR_BOUNDS.east;
    Object.assign(vessel, { lat: inBounds ? lat : null, lon: inBounds ? lon : null, observedAt: at,
      speedKts: numberIn(data.Sog, 0, 102.2), course: numberIn(data.Cog, 0, 359.9), heading: numberIn(data.TrueHeading, 0, 359),
      navigationStatus: type === 'PositionReport' ? numberIn(data.NavigationalStatus, 0, 14) : null });
  }
  if (type === 'ShipStaticData' || type === 'ExtendedClassBPositionReport') {
    if (vessel.detailsReportedAt === null || at >= vessel.detailsReportedAt) {
      Object.assign(vessel, dimensions(data.Dimension), { name: text(data.Name) || vessel.name, shipType: numberIn(data.Type, 1, 99), detailsReportedAt: at });
      if (type === 'ShipStaticData') Object.assign(vessel, { callsign: text(data.CallSign), imo: numberIn(data.ImoNumber, 1, 9999999), destination: text(data.Destination), eta: reportedEta(data.Eta), draftM: numberIn(data.MaximumStaticDraught, .1, 25.5) });
    }
  }
  if (type === 'StaticDataReport') {
    // Parts A/B arrive independently. The unused part is present but Valid=false.
    if (data.ReportA?.Valid && (vessel.nameReportedAt === undefined || at >= vessel.nameReportedAt)) Object.assign(vessel, { name: text(data.ReportA.Name) || vessel.name, nameReportedAt: at });
    if (data.ReportB?.Valid && (vessel.detailsReportedAt === null || at >= vessel.detailsReportedAt)) Object.assign(vessel, dimensions(data.ReportB.Dimension), { callsign: text(data.ReportB.CallSign), shipType: numberIn(data.ReportB.ShipType, 1, 99), detailsReportedAt: at });
  }
  return vessel;
}

export class HarborStore {
  vessels = new Map();
  ingest(event, now = Date.now()) {
    const data = event?.Message?.[event?.MessageType];
    const id = String(data?.UserID ?? '');
    const previous = this.vessels.get(id);
    const next = mergeVessel(previous, event, now);
    if (!next || next === previous) return false;
    this.vessels.delete(id); this.vessels.set(id, next);
    while (this.vessels.size > 500) this.vessels.delete(this.vessels.keys().next().value);
    return true;
  }
  snapshot(now = Date.now()) {
    const result = [];
    for (const [id, vessel] of this.vessels) {
      if (now - vessel.updatedAt > 24 * 60 * 60_000) { this.vessels.delete(id); continue; }
      if (vessel.lat === null || vessel.lon === null || vessel.observedAt === null || now - vessel.observedAt > VESSEL_EXPIRY_MS) continue;
      const ageSeconds = Math.max(0, (now - vessel.observedAt) / 1000);
      result.push({ ...vessel, ...vesselKind(vessel.shipType), navigationLabel: navigationLabel(vessel.navigationStatus), ageSeconds, stale: now - vessel.observedAt > vesselStaleAfter(vessel) });
    }
    return result.sort((a, b) => b.observedAt - a.observedAt);
  }
}
