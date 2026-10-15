import test from 'node:test';
import assert from 'node:assert/strict';
import { towerAlignmentPose, LOGAN_TOWER, apartmentViewPose } from '../src/windowAlignment.mjs';
import { destination, distanceNm, NM_METERS } from '../shared/aviation.mjs';

test('tower alignment points the virtual view at the control tower from the window', () => {
  const home = {...destination(LOGAN_TOWER,245,4000),altitudeM:165,tilt:8};
  const pose = towerAlignmentPose(home);
  assert.ok(pose.bearing > 64 && pose.bearing < 66);
  const eyeHeight = Math.max(home.altitudeM, 8 + 4000 * Math.tan(home.tilt * Math.PI / 180));
  const target = destination(home, pose.bearing, (eyeHeight - 8) / Math.tan(pose.tilt * Math.PI / 180));
  assert.ok(distanceNm(target, LOGAN_TOWER) * NM_METERS < 1);
});

test('apartment scene keeps the saved real eye height and bearing instead of lifting above the window',()=>{
  const home={...destination(LOGAN_TOWER,245,4000),altitudeM:165,bearing:79,zoom:2.2,tilt:8};
  const pose=apartmentViewPose(home);
  assert.deepEqual(pose.eye,{lat:home.lat,lon:home.lon,altitudeM:165});
  assert.ok(Math.abs(distanceNm(home,pose.target)*NM_METERS-4000)<.01);
  assert.equal(pose.target.altitudeM,8);
  assert.deepEqual(apartmentViewPose({...home,tilt:16}),pose);
});
