import { Euler, Quaternion, Vector3 } from 'three';

const radians = Math.PI / 180;
const xAxis = new Vector3(1, 0, 0);
const zAxis = new Vector3(0, 0, 1);
const forward = new Vector3(0, 0, -1);

/** Screen-corrected viewing direction from the rear-facing side of an upright iPad. */
export function lookDirection(alpha, beta, gamma, screenAngle = 0) {
  if (![alpha, beta, gamma, screenAngle].every(Number.isFinite)) return null;
  // Same intrinsic Z-X-Y device rotation and screen correction used by
  // Three.js DeviceOrientationControls. The compass origin is calibrated below.
  const rotation = new Quaternion()
    .setFromEuler(new Euler(beta * radians, alpha * radians, -gamma * radians, 'YXZ'))
    .multiply(new Quaternion().setFromAxisAngle(xAxis, -Math.PI / 2))
    .multiply(new Quaternion().setFromAxisAngle(zAxis, -screenAngle * radians));
  const direction = forward.clone().applyQuaternion(rotation);
  return {
    azimuth: Math.atan2(direction.x, -direction.z) / radians,
    elevation: Math.asin(Math.max(-1, Math.min(1, direction.y))) / radians,
  };
}

export function shortestAngle(degrees) {
  return ((degrees + 180) % 360 + 360) % 360 - 180;
}

export function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

/** Calibrate the present iPad direction to the saved window bearing and tilt. */
export function calibratedView(sample, origin, bearing, tilt) {
  return {
    bearing: ((bearing + shortestAngle(sample.azimuth - origin.azimuth)) % 360 + 360) % 360,
    tilt: clamp(tilt - (sample.elevation - origin.elevation), 3, 45),
  };
}

export function smoothView(current, target, elapsedMs) {
  const weight = 1 - Math.exp(-Math.max(0, elapsedMs) / 110);
  return {
    bearing: ((current.bearing + shortestAngle(target.bearing - current.bearing) * weight) % 360 + 360) % 360,
    tilt: current.tilt + (target.tilt - current.tilt) * weight,
  };
}
