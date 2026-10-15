import test from 'node:test';
import assert from 'node:assert/strict';
import { isTelevision, mapPixelRatio } from '../src/renderProfile.mjs';

test('TV detection does not reduce rendering quality for Samsung phones', () => {
  assert.equal(isTelevision('Mozilla/5.0 (SMART-TV; Linux; Tizen 9.0) SamsungBrowser/6.0 TV Safari/537.36'), true);
  assert.equal(isTelevision('Mozilla/5.0 (Linux; Android 15) SamsungBrowser/28.0 Mobile Safari/537.36'), false);
  assert.equal(isTelevision('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15'), false);
});

test('TV pixel budget covers physical 4K and scaled logical viewports', () => {
  for (const [width, height, dpr] of [[3840, 2160, 1], [1920, 1080, 2], [3840, 1800, 1], [1920, 800, 1]]) {
    const ratio = mapPixelRatio(width, height, dpr, true);
    assert.ok(width * height * ratio ** 2 <= 1920 * 1080 + 1);
    assert.ok(ratio <= dpr);
  }
  assert.equal(mapPixelRatio(3840, 2160, 1, true), .5);
  assert.equal(mapPixelRatio(1920, 1080, 2, true), 1);
  assert.equal(mapPixelRatio(3840, 2160, 2, false), 2);
});

test('empty startup layout and missing pixel ratio remain finite', () => {
  assert.equal(mapPixelRatio(0, 0, undefined, true), 1);
});
