import { normalizeAircraft, destination, LOGAN } from '../shared/aviation.mjs';
import type { Aircraft, Feed } from './types';

const sessionStart = Date.now();
export function demoFeed(): Feed {
  const now = Date.now(), elapsed = ((now - sessionStart) / 1000) % 180;
  const specs = [
    { hex: 'a00001', flight: 'NKS618', r: 'N900NK', t: 'A320', distance: 5800 - elapsed * 20, heading: 22, altitude: 1700 - elapsed * 5, speed: 140, rate: -600, bearingFromAirport: 202 },
    { hex: 'a00002', flight: 'JBU718', r: 'N300J', t: 'BCS3', distance: 9500 - elapsed * 16, heading: 335, altitude: 2900 - elapsed * 4, speed: 165, rate: -500, bearingFromAirport: 155 },
    { hex: 'a00003', flight: 'DAL2406', r: 'N301DQ', t: 'A321', distance: 6200 + elapsed * 10, heading: 60, altitude: 3600 + elapsed * 5, speed: 200, rate: 1200, bearingFromAirport: 60 },
    { hex: 'a00004', flight: 'BAW213', r: 'G-DEMO', t: 'B772', distance: 16500 - elapsed * 15, heading: 240, altitude: 5500 - elapsed * 4, speed: 210, rate: -800, bearingFromAirport: 60 },
    { hex: 'a00005', flight: 'EJA42', r: 'N-DEMO', t: 'C68A', distance: 4200 + elapsed * 10, heading: 60, altitude: 1900 + elapsed * 5, speed: 170, rate: 800, bearingFromAirport: 70 },
    { hex: 'a00006', flight: 'UPS42', r: 'N-DEMO', t: 'B763', distance: 13000 - elapsed * 15, heading: 240, altitude: 4700 - elapsed * 4, speed: 200, rate: -650, bearingFromAirport: 55 },
    { hex: 'a00007', flight: 'ABX42', r: 'N-DEMO', t: 'B763', distance: 18000 - elapsed * 18, heading: 240, altitude: 5800 - elapsed * 4, speed: 230, rate: -750, bearingFromAirport: 55 },
  ];
  const aircraft = specs.map(s => {
    const position = destination(LOGAN, s.bearingFromAirport, Math.max(800, s.distance));
    return normalizeAircraft({ ...s, ...position, alt_baro: s.altitude, alt_geom: s.altitude, gs: s.speed, track: s.heading, baro_rate: s.rate, seen_pos: 0 }, now, now);
  }).filter(Boolean) as Aircraft[];
  return { aircraft, status: 'demo', sourceTime: now, fetchedAt: now, serverTime: now, provider: 'demo', providerName: 'Simulation', attribution: null, ageSeconds: 0, error: null, retryAfterMs: 1000, radiusNm: 40 };
}
