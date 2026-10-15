import { destination } from '../shared/aviation.mjs';
// AIS can be sparse. Predict only a short distance, then hold the last estimate.
export function projectedVessel(vessel, now) {
  const seconds = Math.min(20, Math.max(0, (now - vessel.observedAt) / 1000));
  const moving = Number.isFinite(vessel.speedKts) && vessel.speedKts >= .5 && Number.isFinite(vessel.course) && ![1, 5].includes(vessel.navigationStatus);
  const point = moving ? destination(vessel, vessel.course, vessel.speedKts * .514444 * seconds) : {lat:vessel.lat, lon:vessel.lon};
  return {...point, heading: vessel.heading ?? (moving ? vessel.course : null)};
}
