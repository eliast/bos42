import test from 'node:test';
import assert from 'node:assert/strict';
import { projectedVessel } from '../src/vesselMotion.mjs';
import { distanceNm } from '../shared/aviation.mjs';
const vessel={lat:42.35,lon:-71.02,speedKts:10,course:90,heading:85,navigationStatus:0,observedAt:100000};
test('vessel motion is bounded to twenty seconds and follows course rather than bow heading',()=>{
  const p=projectedVessel(vessel,110000),held=projectedVessel(vessel,120000);
  assert.ok(p.lon>vessel.lon);assert.ok(Math.abs(p.lat-vessel.lat)<.000001);assert.equal(p.heading,85);
  assert.ok(Math.abs(distanceNm(vessel,p)-10*10/3600)<.0001);
  assert.deepEqual(projectedVessel(vessel,900000),held);
});
test('anchored, unknown-speed and unknown-course vessels never drift on guessed inputs',()=>{
  for(const patch of [{navigationStatus:1},{navigationStatus:5},{speedKts:null},{course:null},{speedKts:0}]){
    const p=projectedVessel({...vessel,...patch},150000);assert.equal(p.lat,vessel.lat);assert.equal(p.lon,vessel.lon);
  }
  assert.equal(projectedVessel({...vessel,heading:null,speedKts:0},150000).heading,null);
  assert.equal(projectedVessel({...vessel,heading:null},150000).heading,90);
  assert.ok(Math.abs(projectedVessel(vessel,90000).lon-vessel.lon)<1e-10);
});
