import test from 'node:test';
import assert from 'node:assert/strict';
import { createFaaStatusService, parseBosStatus } from '../server/faaStatus.mjs';

const start = Date.parse('2026-10-03T22:55:00Z');
const html = (stamp = 'Oct 03, 2026 at 10:55 PM UTC') => `<html><tr><th>General Edward Lawrence Logan International Airport (BOS) Real-time Status</th></tr>
  <tr><td><b>Delays by Destination:&nbsp;</b>No destination-specific delays are being reported.</td></tr>
  <tr><td><b>General Departure Delays: </b> Traffic is experiencing gate hold and taxi delays lasting 15 minutes or less.</td></tr>
  <tr><td><b>General Arrival Delays: </b> Arrival traffic is experiencing airborne delays of 15 minutes or less.</td></tr>
  This information was last updated: <b>${stamp}</b></html>`;
const response = body => ({ok: true, text: async () => body});

test('FAA BOS page parses report text and its source timestamp', () => {
  const report = parseBosStatus(html(), start);
  assert.equal(report.updatedAt, start);
  assert.match(report.departures, /15 minutes or less/);
  assert.match(report.arrivals, /airborne delays/);
  assert.match(report.destinations, /No destination-specific delays/);
  assert.equal(parseBosStatus(html().replace('(BOS)', '(JFK)'), start), null);
  assert.equal(parseBosStatus(html('Oct 04, 2026 at 10:55 PM UTC'), start), null);
});

test('FAA status is cached and old or failed updates are marked stale', async () => {
  let clock = start, calls = 0, fail = false;
  const service = createFaaStatusService({now: () => clock, fetchImpl: async () => { calls++; if (fail) throw Error('offline'); return response(html()); }});
  const [first, same] = await Promise.all([service.getSnapshot(), service.getSnapshot()]);
  assert.equal(calls, 1); assert.equal(first.status, 'available'); assert.deepEqual(first, same);
  clock += 299000; await service.getSnapshot(); assert.equal(calls, 1);
  clock += 1000; fail = true;
  const stale = await service.getSnapshot();
  assert.equal(stale.status, 'stale'); assert.equal(stale.report.updatedAt, start);
  clock += 1000; await service.getSnapshot(); assert.equal(calls, 2);
  clock += 31 * 60_000; fail = false;
  assert.equal((await service.getSnapshot()).status, 'stale');
});
