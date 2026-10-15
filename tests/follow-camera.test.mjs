import test from 'node:test';
import assert from 'node:assert/strict';
import {smoothFollowCamera} from '../shared/followCamera.mjs';
const start={lon:-71,lat:42,bearing:359,zoom:14,pitch:58,elevation:300};
test('camera crosses north by the short path and dampens abrupt telemetry corrections',()=>{
  const p=smoothFollowCamera(start,{...start,bearing:1,lat:42.01,elevation:600},33);
  assert.ok(p.bearing>359&&p.bearing<361);assert.ok(p.lat>42&&p.lat<42.002);assert.ok(p.elevation>300&&p.elevation<325);
});
test('damping is consistent at different frame rates and resumes without teleporting',()=>{
  const target={...start,bearing:25,zoom:15,elevation:1000};
  let a=start,b=start;for(let i=0;i<60;i++)a=smoothFollowCamera(a,target,1000/60);for(let i=0;i<30;i++)b=smoothFollowCamera(b,target,1000/30);
  for(const k of Object.keys(a))assert.ok(Math.abs(a[k]-b[k])<1e-8);
  const resumed=smoothFollowCamera(start,target,60000);assert.ok(resumed.elevation<500);assert.ok(resumed.bearing<365);
  assert.deepEqual(smoothFollowCamera(start,target,0),start);
});
