import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAircraft, normalizeFeed, projectedPosition, destination, distanceNm, bearing, angleDifference, airlineFor, flightLabel, routeFitsAircraft, LOGAN } from '../shared/aviation.mjs';
import { meanSeaLevel } from 'egm96-universal';

const now = 1791035000000;
const report = (overrides = {}) => ({ hex: 'a12345', flight: 'NKS618 ', lat: 42.31, lon: -71.03, alt_geom: 1300, alt_baro: 1100, gs: 140, track: 20, geom_rate: -600, seen_pos: 2, ...overrides });

test('airline colors and flight identity come from operating callsign', () => {
  assert.equal(airlineFor('NKS618').color, '#FFE000');
  assert.equal(flightLabel('NKS618 '), 'NK618');
  assert.equal(airlineFor('AAY1884').name, 'Allegiant');
  assert.equal(flightLabel('AAY1884'), 'G41884');
  assert.equal(flightLabel('', 'N123AB'), 'N123AB');
  assert.equal(airlineFor('UNKNOWN').name, 'Other aircraft');
});
test('normalization rejects invalid positions, vehicles and old reports', () => {
  for (const patch of [{lat: NaN}, {lat: 91}, {lon: 181}, {hex: 'nothex'}, {category: 'C1'}, {seen_pos: 121}, {alt_baro: null, alt_geom: null}]) {
    assert.equal(normalizeAircraft(report(patch), now, now), null);
  }
  assert.equal(normalizeAircraft(report({seen_pos: 120}), now, now).callsign, 'NKS618');
});
test('position timestamp reflects observation age, not just server fetch time', () => {
  const a = normalizeAircraft(report({seen_pos: 12}), now - 5000, now);
  assert.equal(a.observedAt, now - 17000);
  assert.equal(a.positionAgeSeconds, 17);
});
test('live GNSS heights convert from ellipsoid to EGM96 sea level', () => {
  const body = { now, ac: [report({ lat: LOGAN.lat, lon: LOGAN.lon, alt_geom: -75 })] };
  const a = normalizeFeed(body, now, meanSeaLevel).aircraft[0];
  assert.ok(a.geoidOffsetM < -28 && a.geoidOffsetM > -29);
  assert.ok(a.altitudeFt > 18 && a.altitudeFt < 20);
  assert.equal(a.geometricAltitudeFt, -75);
  assert.equal(a.altitudeSource, 'geometric');
});
test('ground and barometric fallback remain explicit', () => {
  const ground = normalizeAircraft(report({ alt_baro: 'ground', alt_geom: 600, gs: 8 }), now, now);
  assert.equal(ground.altitudeFt, LOGAN.elevationFt);
  assert.equal(ground.phase, 'Taxiing');
  const baro = normalizeAircraft(report({ alt_geom: undefined }), now, now, -28.5);
  assert.equal(baro.altitudeFt, 1100);
  assert.equal(baro.altitudeSource, 'barometric');
});
test('feed handles seconds and milliseconds, and rejects stale/malformed payloads', () => {
  assert.equal(normalizeFeed({now: now / 1000, aircraft: [report()]}, now).sourceTime, now);
  assert.equal(normalizeFeed({now, ac: []}, now).sourceTime, now);
  assert.throws(() => normalizeFeed({now: now - 601000, ac: []}, now), /live window/);
  assert.throws(() => normalizeFeed({now: now + 61000, ac: []}, now), /live window/);
  assert.throws(() => normalizeFeed({error: 'no data'}, now), /aircraft array/);
});
test('positions stop extrapolating after eight seconds', () => {
  const a = normalizeAircraft(report({seen_pos: 0, gs: 360, track: 90, geom_rate: 600}), now, now);
  const p8 = projectedPosition(a, now + 8000), p60 = projectedPosition(a, now + 60000);
  assert.ok(Math.abs(distanceNm(a, p8) - .8) < .001);
  assert.equal(p8.lat, p60.lat); assert.equal(p8.lon, p60.lon);
  assert.equal(p8.altitudeFt, p60.altitudeFt);
  assert.equal(p8.frozen, false); assert.equal(p60.frozen, true);
});
test('unknown heading does not invent a northbound track', () => {
  const a = normalizeAircraft(report({ track: undefined }), now, now);
  const p = projectedPosition(a, now + 4000);
  assert.equal(p.lat, a.lat); assert.equal(p.lon, a.lon);
  assert.notEqual(a.phase, 'Likely arrival');
  const headingOnly = normalizeAircraft(report({track: undefined, true_heading: 90}), now, now);
  assert.equal(projectedPosition(headingOnly, now+5000).lon, headingOnly.lon);
});
test('arrival inference distinguishes approach and departure', () => {
  const south = destination(LOGAN, 200, 6000);
  const inbound = normalizeAircraft(report({...south, track: bearing(south, LOGAN)}), now, now);
  assert.equal(inbound.phase, 'Likely arrival');
  assert.equal(normalizeAircraft(report({...south, track: 200, geom_rate: 1500}), now, now).phase, 'Climbing');
  assert.equal(angleDifference(1, 359), 2);
  const far=destination(LOGAN,200,12*1852);
  assert.notEqual(normalizeAircraft(report({...far,alt_geom:600,track:bearing(far,LOGAN)}),now,now).phase,'Likely arrival');
});
test('a reused callsign cannot show an incompatible non-Boston route on final approach', () => {
  const a = normalizeAircraft(report(), now, now);
  const route = { callsign: 'NKS618', origin: {iata:'FLL'}, destination: {iata:'BOS'} };
  assert.equal(routeFitsAircraft(route, a), true);
  assert.equal(routeFitsAircraft({...route, destination: {iata:'PIE'}}, a), false);
  assert.equal(routeFitsAircraft({...route, callsign:'NKS999'}, a), false);
  assert.equal(routeFitsAircraft({...route, destination:null}, a), false);
});
