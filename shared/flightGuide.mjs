import { AIRLINES } from './aviation.mjs';

// Operator identity is evidence of a business model, not the mission or payload
// of this particular flight. Never infer a customer from a callsign or N-number.
export const GUIDE_SOURCES = {
  operators: 'https://www.faa.gov/air_traffic/publications/atpubs/cnt_html/chap3_section_3.html',
  netjets: 'https://www.netjets.com/en-us/private-jet-share-program',
  flexjet: 'https://flexjet.com/en-us/programs',
  amazon: 'https://www.amazonaircargo.com/',
  usps: 'https://about.usps.com/newsroom/statements/040124-usps-statement-on-award-to-ups-for-contract-to-support-air-cargo-transportation.htm',
};

const privateOperators = {
  EJA: { name: 'NetJets', source: GUIDE_SOURCES.netjets },
  LXJ: { name: 'Flexjet', source: GUIDE_SOURCES.flexjet },
};
const cargoOperators = new Set(['FDX', 'UPS', 'ABX']);
// These operators have more than one kind of operation. A prefix alone cannot
// distinguish a passenger flight, cargo contract, charter or repositioning leg.
const mixedOperators = new Set(['SCX', 'HAL', 'ATN', 'GTI']);
const amazonPartners = new Set(['ABX', 'ATN', 'SCX', 'HAL']);
const regionalOperators = new Set(['RPA', 'EDV', 'SKW', 'ENY', 'JZA']);
const businessTypes = new Set(['C25A', 'C25B', 'C25C', 'C510', 'C525', 'C550', 'C560', 'C56X', 'C680', 'C68A', 'C700', 'C750', 'CL30', 'CL35', 'CL60', 'GL5T', 'GL6T', 'GLEX', 'GL7T', 'GLF4', 'GLF5', 'GLF6', 'GA5C', 'GA6C', 'GA7C', 'FA7X', 'FA8X', 'F900', 'F2TH', 'E50P', 'E55P', 'E545', 'E550', 'H25B', 'HDJT', 'LJ35', 'LJ45', 'LJ60', 'LJ75']);

/** @param {{callsign?: string, aircraftType?: string|null}|null} aircraft */
export function classifyFlight(aircraft) {
  const prefix = String(aircraft?.callsign || '').trim().toUpperCase().slice(0, 3);
  const privateOperator = privateOperators[prefix];
  if (privateOperator) return {
    kind: 'private', label: 'Private / charter', shortLabel: 'PRIVATE / CHARTER', basis: 'Known private-aviation operator',
    detail: `${privateOperator.name} provides private aviation. This identifies the operator, not who is aboard or whether this leg carries passengers.`,
    source: privateOperator.source,
  };
  if (cargoOperators.has(prefix)) return {
    kind: 'cargo', label: 'Cargo operator', shortLabel: 'CARGO', basis: 'Known cargo operator',
    detail: `${AIRLINES[prefix].name} is a cargo operator. The feed does not identify the shipment, customer, or whether this leg is loaded.`,
    source: GUIDE_SOURCES.operators,
  };
  if (mixedOperators.has(prefix)) return {
    kind: 'mixed', label: 'Mixed operations', shortLabel: 'MISSION UNKNOWN', basis: 'Operator has multiple kinds of flights',
    detail: `${AIRLINES[prefix].name} has multiple kinds of operations. The callsign alone does not establish whether this flight carries passengers or freight.`,
    source: GUIDE_SOURCES.operators,
  };
  if (AIRLINES[prefix]) return {
    kind: 'airline', label: regionalOperators.has(prefix) ? 'Regional airline' : 'Airline operator', shortLabel: regionalOperators.has(prefix) ? 'REGIONAL' : 'AIRLINE', basis: 'Based on operating callsign',
    detail: 'The operating airline is identified. Airlines may also carry cargo or fly charters and empty repositioning legs; the mission and passenger count are not provided by this feed.',
    source: GUIDE_SOURCES.operators,
  };
  if (businessTypes.has(String(aircraft?.aircraftType || '').toUpperCase())) return {
    kind: 'business', label: 'Business jet · inferred', shortLabel: 'BUSINESS JET?', basis: 'Inferred from aircraft model',
    detail: 'This model is commonly used in business aviation. Private ownership, charter use and the purpose of this flight are unverified.',
    source: null,
  };
  return { kind: 'unknown', label: 'Use unverified', shortLabel: 'UNVERIFIED', basis: 'Insufficient operator information', detail: 'A registration number or small aircraft does not prove a private flight. The operator and mission have not been established.', source: null };
}

/** @param {{callsign?: string}|null} aircraft */
export function commercialConnection(aircraft) {
  const prefix = String(aircraft?.callsign || '').trim().toUpperCase().slice(0, 3);
  if (prefix === 'UPS') return {
    label: 'USPS connection',
    text: 'USPS awarded UPS an air-transport contract in 2024. That relationship does not tell us whether mail is aboard this flight.',
    source: GUIDE_SOURCES.usps,
  };
  if (amazonPartners.has(prefix)) return {
    label: 'Amazon Air connection',
    text: 'Amazon lists this operator among its air-carrier partners. An Amazon assignment for this particular flight is unverified.',
    source: GUIDE_SOURCES.amazon,
  };
  return null;
}

/**
 * Only describe fields we actually receive. Distance to Logan is not distance
 * remaining on the flight, and ground track is not the nose's heading.
 * @param {import('../src/types').Aircraft|null} aircraft
 * @param {import('../src/types').Route|null} route
 * @param {string} aircraftName
 */
export function flightFacts(aircraft, route, aircraftName, {telemetry = true} = {}) {
  if (!aircraft) return [{ label: 'This flight', text: 'Select an aircraft to see its flight details.' }];
  const a = aircraft, classification = classifyFlight(a);
  const facts = [{ label: 'Operator', text: `${a.operator} · ${classification.label}` }];
  if (route?.origin && route?.destination) {
    const from = route.origin.municipality || route.origin.iata || route.origin.icao;
    const to = route.destination.municipality || route.destination.iata || route.destination.icao;
    const inbound = route.destination.icao === 'KBOS' || route.destination.iata === 'BOS';
    facts.push({ label: 'Published route', text: inbound ? `From ${from}` : `${from} → ${to}` });
  }
  if (a.aircraftType) facts.push({ label: 'Airframe', text: `${aircraftName}${a.registration ? ` · ${a.registration}` : ''}` });
  else if (a.registration) facts.push({ label: 'Registration', text: a.registration });
  if (Number.isFinite(a.distanceNm)) facts.push({ label: 'Logan distance', text: `${a.distanceNm.toFixed(1)} nautical miles from Logan` });
  if (telemetry && Number.isFinite(a.speedKts) && a.speedKts > 0) facts.push({ label: 'Groundspeed', text: `${Math.round(a.speedKts)} knots · ${Math.round(a.speedKts * 1.15078)} mph over the ground` });
  if (telemetry && a.headingKnown) facts.push({ label: 'Ground track', text: `${Math.round(a.heading) % 360}° · direction of travel over the ground` });
  if (telemetry && !a.ground && Math.abs(a.verticalRateFpm) >= 150) facts.push({ label: a.verticalRateFpm < 0 ? 'Descending' : 'Climbing', text: `${Math.round(Math.abs(a.verticalRateFpm)).toLocaleString('en-US')} feet per minute · last report` });
  return facts;
}
