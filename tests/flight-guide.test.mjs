import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFlight, commercialConnection, flightFacts } from '../shared/flightGuide.mjs';
import { normalizeAircraft } from '../shared/aviation.mjs';

const plane = (patch = {}) => normalizeAircraft({ hex: 'a12345', flight: 'N123AB', r: 'N123AB', t: 'C172', lat: 42.36, lon: -71.04, alt_baro: 2000, ...patch }, Date.now());

test('a registration, absent operator or small plane does not imply a private flight', () => {
  assert.equal(classifyFlight(plane()).kind, 'unknown');
  assert.equal(classifyFlight(plane({ flight: '', t: 'PC12' })).kind, 'unknown');
  assert.equal(classifyFlight(plane({ flight: 'N123AB', t: 'GLF6' })).kind, 'business');
  assert.match(classifyFlight(plane({ t: 'GLF6' })).label, /inferred/);
});
test('operator evidence takes priority over the model and stays separate from mission', () => {
  assert.equal(classifyFlight(plane({ flight: 'EJA42' })).kind, 'private');
  assert.equal(classifyFlight(plane({ flight: 'LXJ42' })).kind, 'private');
  assert.equal(classifyFlight(plane({ flight: 'FDX42', t: 'C208' })).kind, 'cargo');
  assert.match(classifyFlight(plane({ flight: 'UPS42' })).detail, /whether this leg is loaded/);
  assert.equal(classifyFlight(plane({ flight: 'JBU42' })).kind, 'airline');
});
test('Amazon partner callsigns never become a confirmed Amazon cargo assignment', () => {
  for (const flight of ['SCX42', 'HAL42', 'ATN42']) {
    const a = plane({ flight, t: 'B738' });
    assert.equal(classifyFlight(a).kind, 'mixed');
    assert.match(commercialConnection(a).text, /particular flight is unverified/);
  }
  assert.equal(classifyFlight(plane({ flight: 'ABX42' })).kind, 'cargo');
  assert.equal(commercialConnection(plane({ flight: 'GTI42' })), null);
  assert.equal(commercialConnection(plane({ flight: 'N123AB' })), null);
});
test('USPS is a contractual connection, never an inferred manifest', () => {
  const result = commercialConnection(plane({ flight: 'UPS42' }));
  assert.match(result.text, /does not tell us whether mail is aboard/);
  assert.match(result.source, /^https:\/\/about.usps.com\//);
  assert.equal(commercialConnection(plane({ flight: 'FDX42' })), null);
});
test('story facts omit unknown track and rate, identify ground distance, and never invent schedule data', () => {
  const facts = flightFacts(plane(), null, 'Cessna 172');
  assert.ok(!facts.some(fact => /Ground track|Climbing|Descending/.test(fact.label)));
  assert.match(JSON.stringify(facts), /nautical miles from Logan/);
  assert.doesNotMatch(JSON.stringify(facts), /on time|late|daily|passengers|time airborne/i);
  const a = plane({ track: 360, baro_rate: -512 });
  assert.match(flightFacts(a, null, 'Cessna 172').find(f => f.label === 'Ground track').text, /^0°/);
  assert.match(flightFacts(a, null, 'Cessna 172').find(f => f.label === 'Descending').text, /512 feet per minute/);
});
test('published inbound routes show the origin without a redundant Boston destination', () => {
  const facts = flightFacts(plane(), { origin: { municipality: 'London' }, destination: { iata: 'BOS' } }, 'Cessna 172');
  assert.equal(facts.find(f => f.label === 'Published route').text, 'From London');
  assert.ok(flightFacts(null, null, '').length);
});

test('ticker facts describe only the selected flight, with no lesson filler or invented speed', () => {
  const american = flightFacts(plane({flight: 'AAL123', t: 'A321', r: 'N123AA', gs: 140}), null, 'Airbus A321');
  const privateJet = flightFacts(plane({flight: 'EJA42', t: 'C68A', r: 'N42QS'}), null, 'Cessna Citation Latitude');
  assert.match(JSON.stringify(american), /American/);
  assert.match(JSON.stringify(american), /140 knots · 161 mph/);
  assert.doesNotMatch(JSON.stringify(privateJet), /American|N123AA|140 knots/);
  assert.ok(!privateJet.some(fact => fact.label === 'Groundspeed'));
  for (const facts of [american, privateJet, flightFacts(null, null, '')]) assert.doesNotMatch(JSON.stringify(facts), /flight school|radio example|cleared to land|USPS|Amazon/i);
});
