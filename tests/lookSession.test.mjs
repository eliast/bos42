import test from 'node:test';
import assert from 'node:assert/strict';
import { LookSession } from '../src/lookSession.mjs';

const home = { bearing: 79, tilt: 8 };
const initial = { azimuth: 170, elevation: 3 };

test('motion starts without requiring optional alignment', () => {
  const session = new LookSession();
  session.receive(initial, 'first', home, 100);
  assert.deepEqual(session.view(100), home);
  assert.equal(session.calibration.explicit, false);
  session.receive({ azimuth: -170, elevation: 5 }, 'first', home, 120);
  assert.deepEqual(session.view(120), { bearing: 99, tilt: 6 });
});

test('calibration persists while readings continue, including a long mode switch', () => {
  const session = new LookSession();
  session.receive(initial, 'first', home, 100);
  session.align(home, 100);
  const calibration = session.calibration;
  // Camera modes do not recreate the sensor reference or align the session.
  session.receive({ azimuth: -170, elevation: 3 }, 'first', home, 3_600_000);
  assert.equal(session.calibration, calibration);
  assert.deepEqual(session.view(3_600_000), { bearing: 99, tilt: 8 });
});

test('Align replaces the origin with the present orientation', () => {
  const session = new LookSession();
  session.receive(initial, 'first', home, 100);
  session.receive({ azimuth: -170, elevation: 5 }, 'first', home, 120);
  assert.equal(session.align(home, 140), true);
  assert.deepEqual(session.view(140), home);
  session.receive({ azimuth: -160, elevation: 6 }, 'first', home, 160);
  assert.deepEqual(session.view(160), { bearing: 89, tilt: 7 });
});

test('a new native reference cannot reuse a previous alignment', () => {
  const session = new LookSession();
  session.receive(initial, 'first', home, 100);
  session.receive({ azimuth: 0, elevation: 0 }, 'restarted', home, 200);
  assert.equal(session.needsAlignment, true);
  assert.equal(session.view(200), null);
  assert.equal(session.align(home, 220), true);
  assert.deepEqual(session.view(220), home);
});

test('background reset requires a fresh reading before aligning', () => {
  const session = new LookSession();
  session.receive(initial, 'first', home, 100);
  session.invalidate();
  assert.equal(session.align(home, 120), false);
  assert.equal(session.view(120), null);
  session.receive(initial, 'second', home, 200);
  assert.equal(session.view(200), null);
  assert.equal(session.align(home, 200), true);
  assert.deepEqual(session.view(200), home);
});

test('stale or invalid sensor values cannot drive or align the camera', () => {
  const session = new LookSession();
  session.receive(initial, 'first', home, 100);
  assert.equal(session.receive({ azimuth: NaN, elevation: 0 }, 'first', home, 500), false);
  assert.equal(session.receive(initial, '', home, 500), false);
  assert.equal(session.view(1_101), null);
  assert.equal(session.align(home, 1_101), false);
  session.receive(initial, 'first', home, 1_200);
  assert.deepEqual(session.view(1_200), home);
  assert.equal(session.align({ bearing: NaN, tilt: 8 }, 1_200), false);
});
