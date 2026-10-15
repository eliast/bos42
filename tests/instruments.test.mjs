import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAircraft } from '../shared/aviation.mjs';
import { instrumentReadings, continueAngle, dialAngle } from '../shared/instruments.mjs';
import { flightFacts } from '../shared/flightGuide.mjs';

const plane = (patch = {}) => normalizeAircraft({hex:'a12345',flight:'AAL1401',r:'N557UW',t:'A321',lat:42.36,lon:-71.04,alt_baro:1250,...patch}, Date.now());

test('instruments distinguish missing speed/rate from measured zero', () => {
  const missing = instrumentReadings(plane());
  assert.equal(missing.speed, null);
  assert.equal(missing.verticalSpeed, null);
  assert.equal(missing.track, null);
  const level = instrumentReadings(plane({gs:0,baro_rate:0,track:0}));
  assert.equal(level.speed, 0);
  assert.equal(level.verticalSpeed, 0);
  assert.equal(level.track, 0);
  assert.equal(instrumentReadings(plane({gs:-1})).speed, null);
  const legacy = {...plane(), speedKts:0, verticalRateFpm:0};
  delete legacy.speedKnown; delete legacy.verticalRateKnown;
  assert.equal(instrumentReadings(legacy).speed, null);
  assert.equal(instrumentReadings(legacy).verticalSpeed, null);
});

test('gauges retain altitude reference and do not turn heading or ground elevation into telemetry', () => {
  assert.equal(instrumentReadings(plane()).altitudeUnit, 'FT BARO');
  assert.equal(instrumentReadings(plane({alt_geom:1400})).altitudeUnit, 'FT MSL');
  assert.equal(instrumentReadings(plane({alt_baro:-125})).altitude, -125);
  assert.equal(instrumentReadings(plane({true_heading:90})).track, null);
  assert.equal(instrumentReadings(plane({track:360})).track, 0);
  const ground = instrumentReadings(plane({alt_baro:'ground',gs:15,baro_rate:0}));
  assert.equal(ground.speed,15);
  assert.equal(ground.altitude,null);
  assert.equal(ground.verticalSpeed,null);
  assert.equal(ground.altitudeUnit,'ON GROUND');
});

test('compass crosses north without a full spin and analog pointer stops at its scale', () => {
  assert.equal(continueAngle(359,1),361);
  assert.equal(continueAngle(1,359),-1);
  assert.equal(continueAngle(721,359),719);
  assert.equal(dialAngle(0,-3000,3000,-250,70),-90);
  assert.equal(dialAngle(5000,-3000,3000,-250,70),70);
  assert.equal(dialAngle(-5000,-3000,3000,-250,70),-250);
});

test('cockpit radio retains flight context without repeating instrument readings', () => {
  const aircraft=plane({gs:143,baro_rate:-700,track:22});
  const normal=flightFacts(aircraft,null,'Airbus A321');
  const cockpit=flightFacts(aircraft,null,'Airbus A321',{telemetry:false});
  assert.ok(normal.some(f=>f.label==='Groundspeed'));
  assert.ok(cockpit.some(f=>f.label==='Airframe' && f.text.includes('N557UW')));
  assert.ok(cockpit.some(f=>f.label==='Logan distance'));
  assert.ok(!cockpit.some(f=>['Groundspeed','Ground track','Descending','Climbing','Altitude'].includes(f.label)));
});
