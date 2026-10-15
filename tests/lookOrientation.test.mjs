import test from 'node:test';
import assert from 'node:assert/strict';
import { calibratedView, lookDirection, shortestAngle, smoothView } from '../src/lookOrientation.mjs';

test('upright device is level; tipping it changes elevation', () => {
  assert.ok(Math.abs(lookDirection(0, 90, 0, 0).elevation) < 1e-6);
  assert.ok(Math.abs(lookDirection(0, 120, 0, 0).elevation - 30) < 1e-6);
});

test('screen correction handles both landscape orientations', () => {
  for (const [gamma, screen] of [[90, 90], [-90, -90]]) {
    assert.ok(Math.abs(lookDirection(0, 0, gamma, screen).elevation) < 1e-6);
  }
});

test('calibration keeps the chosen bearing and crosses north by the short path', () => {
  const origin = { azimuth: 179, elevation: 0 };
  assert.deepEqual(calibratedView(origin, origin, 79, 8), { bearing: 79, tilt: 8 });
  assert.equal(calibratedView({ azimuth: -179, elevation: 0 }, origin, 79, 8).bearing, 81);
  assert.equal(shortestAngle(-358), 2);
});

test('smoothing follows the short bearing arc and limits vertical look', () => {
  const view = smoothView({ bearing: 359, tilt: 8 }, { bearing: 1, tilt: 10 }, 110);
  assert.ok(view.bearing > 359 || view.bearing < 1);
  assert.ok(view.tilt > 8 && view.tilt < 10);
  assert.equal(calibratedView({ azimuth: 0, elevation: -100 }, { azimuth: 0, elevation: 0 }, 79, 8).tilt, 45);
});
