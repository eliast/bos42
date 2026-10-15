import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAircraftProfile as resolve, supportedAircraftTypes } from '../shared/aircraftProfiles.mjs';

test('generation and variant codes resolve without crossing engine generations', () => {
  assert.match(resolve(' a320 ').engines, /CFM56/);
  assert.match(resolve('A20N').engines, /LEAP-1A/);
  assert.match(resolve('B738').engines, /CFM56/);
  assert.match(resolve('B38M').engines, /LEAP-1B/);
  assert.ok(resolve('B78X').length > resolve('B788').length);
  assert.equal(resolve('A320neo'), resolve('A20N'));
});
test('ambiguous variants explicitly disclose the scope and omit unsafe values', () => {
  for (const type of ['A21N', 'B772', 'B739', 'B763']) assert.ok(resolve(type).fallback);
  assert.equal(resolve('B763').capacity, null);
  assert.equal(resolve('B763').range, null);
  assert.match(resolve('B772').range, /-200ER/);
  assert.match(resolve('A21N').range, /LR/);
});
test('unsupported and missing identities never guess or access prototype keys', () => {
  for (const type of [null, undefined, '', 'ZZZZ', 'A320FAKE', 'constructor', '__proto__']) assert.equal(resolve(type), null);
});
test('offline catalog has valid sourced geometry and engine layout', () => {
  for (const type of supportedAircraftTypes) {
    const p = resolve(type);
    assert.ok(p.length > 0 && p.span > 0, type);
    assert.equal(p.engineCount, 2);
    assert.ok(['wing', 'rear', 'rotor'].includes(p.enginePosition));
    assert.ok(p.sources.length > 0, type);
    assert.ok(p.sources.some(s => new URL(s.url).hostname !== 'en.wikipedia.org'), type);
    for (const s of p.sources) assert.equal(new URL(s.url).protocol, 'https:');
  }
  assert.equal(resolve('C68A').enginePosition, 'rear');
});

test('size lineup preserves every model and orders by physical length', async () => {
  const { aircraftByLength } = await import('../shared/aircraftProfiles.mjs');
  assert.equal(aircraftByLength.length, supportedAircraftTypes.length);
  assert.ok(aircraftByLength[0].length < resolve('C68A').length);
  assert.equal(aircraftByLength.at(-1).code, 'B77W');
  assert.ok(aircraftByLength.every((p, i, all) => !i || p.length >= all[i - 1].length));
});

test('expanded catalog covers the missing types seen in the Boston feed',()=>{
  for(const code of ['E75L','E75S','E170','E190','EC45','H145','B752','A359','CL35','CRJ9','A306','C700','C25B','C25C'])assert.ok(resolve(code),code);
  assert.ok(supportedAircraftTypes.length>=40);
  assert.ok(resolve('E75L').span>resolve('E75S').span);
  assert.equal(resolve('H145').engineKind,'turboshaft');
  assert.equal(resolve('H145').enginePosition,'rotor');
  assert.ok(resolve('EC45').fallback);
});
test('model facts label historical prices and fuel references instead of inventing live flight metrics',async()=>{
  const {aircraftModelFacts}=await import('../shared/aircraftProfiles.mjs');
  assert.deepEqual(aircraftModelFacts(null),[]);
  assert.match(aircraftModelFacts('A20N').find(f=>f.label==='Historical list price').text,/2018 list price/);
  assert.match(aircraftModelFacts('CL35').find(f=>f.label==='Published fuel reference').text,/3500 study.*800 NM.*4 passengers/);
  assert.ok(!aircraftModelFacts('B752').some(f=>/fuel|price/i.test(f.label)));
  assert.match(aircraftModelFacts('H145').find(f=>f.label==='Size').text,/rotor diameter/);
});

test('regional, business and helicopter expansion preserves variant boundaries',()=>{
  for(const code of ['E195','E290','E295','C25M','E550','GL5T','GLEX','H135','EC35','H160'])assert.ok(resolve(code),code);
  assert.ok(supportedAircraftTypes.length>=50);
  assert.match(resolve('E195').engines,/CF34/);
  assert.match(resolve('E295').engines,/PW1900G/);
  for(const code of ['C25M','E550','GL5T','GLEX','EC35'])assert.ok(resolve(code).fallback,code);
  assert.equal(resolve('H160').airframeKind,'helicopter');
});
