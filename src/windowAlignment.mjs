import { bearing, destination, distanceNm, NM_METERS } from '../shared/aviation.mjs';

// Logan's control tower, rather than the airport centroid.
// https://commons.wikimedia.org/wiki/File:2017_Logan_Airport_Control_Tower_from_Boston_Harbor_2.jpg
export const LOGAN_TOWER = { lat: 42.365755, lon: -71.018438 };

export function towerAlignmentPose(home) {
  const eyeHeight = Math.max(home.altitudeM, 8 + 4000 * Math.tan((home.tilt || 8) * Math.PI / 180));
  const distance = distanceNm(home, LOGAN_TOWER) * NM_METERS;
  return {
    bearing: bearing(home, LOGAN_TOWER),
    // Match the app's elevated perspective to the tower's ground position.
    tilt: Math.max(3, Math.min(45, Math.atan2(eyeHeight - 8, distance) * 180 / Math.PI)),
  };
}

// Fixed eye-level scene. The elevated Window/sensor perspective is separate.
export function apartmentViewPose(home) {
  return {eye:{lon:home.lon,lat:home.lat,altitudeM:home.altitudeM},target:{...destination(home,home.bearing,4000),altitudeM:8}};
}
