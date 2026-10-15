import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeatherService, normalizeWeather } from '../server/weather.mjs';

const start = 1791061200000;
const sample = (patch = {}) => ({ icaoId: 'KBOS', obsTime: start / 1000, rawOb: 'KBOS 032100Z VRB03KT 10SM FEW045 17/11 A3028', temp: 17, dewp: 11, wdir: 'VRB', wspd: 3, visib: '10+', altim: 1025.5, clouds: [{cover: 'FEW', base: 4500}], fltCat: 'VFR', ...patch });
const response = body => ({ok: true, status: 200, json: async () => body});

test('weather preserves METAR units, variable winds, missing fields and observation time', () => {
  const report = normalizeWeather(sample(), start);
  assert.equal(report.observedAt, start);
  assert.equal(report.windDirection, 'VRB');
  assert.equal(report.visibilityMiles, '10+');
  assert.equal(report.clouds[0].baseFt, 4500);
  assert.equal(report.altimeterHpa, 1025.5);
  const missing = normalizeWeather(sample({ temp: null, wspd: null, clouds: [], altim: null }), start);
  assert.equal(missing.temperatureC, null);
  assert.equal(missing.windSpeedKts, null);
  assert.equal(missing.altimeterHpa, null);
  for (const patch of [{icaoId: 'KJFK'}, {obsTime: (start + 3600000) / 1000}, {rawOb: ''}]) assert.equal(normalizeWeather(sample(patch), start), null);
});

test('weather coalesces viewers, caches five minutes, and keeps the newest Logan observation', async () => {
  let clock = start, calls = 0;
  const service = createWeatherService({now: () => clock, fetchImpl: async () => { calls++; return response([sample({obsTime: start / 1000 - 3600}), sample()]); }});
  const [a,b] = await Promise.all([service.getSnapshot(), service.getSnapshot()]);
  assert.equal(calls, 1); assert.deepEqual(a,b); assert.equal(a.report.observedAt, start);
  clock += 299000; await service.getSnapshot(); assert.equal(calls, 1);
  clock += 1000; await service.getSnapshot(); assert.equal(calls, 2);
});

test('old or failed weather stays explicitly stale and failed requests back off', async () => {
  let clock = start, fail = false, calls = 0;
  const service = createWeatherService({now: () => clock, fetchImpl: async () => { calls++; if (fail) throw Error('offline'); return response([sample()]); }});
  await service.getSnapshot(); clock += 300000; fail = true;
  const stale = await service.getSnapshot();
  assert.equal(stale.status, 'stale'); assert.equal(stale.report.observedAt, start);
  clock += 1000; await service.getSnapshot(); assert.equal(calls, 2);
  clock += 60000; await service.getSnapshot(); assert.equal(calls, 3);
  fail = false; clock = start + 91 * 60000;
  assert.equal((await service.getSnapshot()).status, 'stale');
  const empty = createWeatherService({now: () => clock, fetchImpl: async () => response([])});
  assert.equal((await empty.getSnapshot()).status, 'unavailable');
});
