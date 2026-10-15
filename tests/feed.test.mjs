import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedService, createRouteService } from '../server/feed.mjs';

const start = 1791035000000;
const primary = {id:'primary', name:'Primary', url:'https://primary.invalid', attribution:'https://primary.invalid'};
const fallback = {id:'backup', name:'Backup', url:'https://backup.invalid', attribution:'https://backup.invalid'};
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const sample = time => ({now: time, ac:[{hex:'a12345',flight:'NKS1',lat:42.32,lon:-71.02,alt_geom:1000,seen_pos:0,gs:140,track:20}]});

test('concurrent viewers share one upstream request and cache', async () => {
  let calls = 0, clock = start;
  const service = createFeedService({now:()=>clock, providers:[primary], fetchImpl:async()=>{calls++; return response(sample(clock));}});
  const [a,b] = await Promise.all([service.getSnapshot(), service.getSnapshot()]);
  assert.equal(calls,1); assert.equal(a.status,'live'); assert.deepEqual(a,b);
  clock += 4000; await service.getSnapshot(); assert.equal(calls,1);
  clock += 1000; await service.getSnapshot(); assert.equal(calls,2);
});
test('failed primary uses the backup and its attribution', async () => {
  const service = createFeedService({now:()=>start, providers:[primary,fallback], fetchImpl:async url=>url===primary.url ? response({},503) : response(sample(start))});
  const value=await service.getSnapshot();
  assert.equal(value.status,'live'); assert.equal(value.provider,'backup');
  assert.equal(value.attribution,fallback.attribution);
});
test('a working backup is retained briefly instead of retrying a broken primary on every poll', async () => {
  let clock=start; const calls=[];
  const service=createFeedService({now:()=>clock,providers:[primary,fallback],fetchImpl:async url=>{calls.push(url);return url===primary.url?response({},503):response(sample(clock));}});
  await service.getSnapshot();clock+=5000;await service.getSnapshot();
  assert.deepEqual(calls,[primary.url,fallback.url,fallback.url]);
  clock+=60000;await service.getSnapshot();
  assert.equal(calls.at(-2),primary.url);
});
test('a provider serving old data falls back to a current provider', async () => {
  const service=createFeedService({now:()=>start,providers:[primary,fallback],fetchImpl:async url=>response(sample(url===primary.url?start-30000:start))});
  const value=await service.getSnapshot();assert.equal(value.provider,'backup');assert.equal(value.status,'live');
});
test('briefly missing callsigns retain observed identity without retaining old positions', async () => {
  let clock=start;
  const service=createFeedService({now:()=>clock,providers:[primary],fetchImpl:async()=>{const body=sample(clock);if(clock>start){body.ac[0].flight='';body.ac[0].lat=42.36;}return response(body);}});
  await service.getSnapshot();clock+=5000;const current=(await service.getSnapshot()).aircraft[0];
  assert.equal(current.callsign,'NKS1');assert.equal(current.color,'#FFE000');assert.equal(current.lat,42.36);assert.equal(current.identityObservedAt,start);
  clock+=601000;assert.equal((await service.getSnapshot()).aircraft[0].callsign,'');
});
test('connection loss preserves last observation with stale status; no fabricated traffic', async () => {
  let fail=false,clock=start;
  const service=createFeedService({now:()=>clock,providers:[primary],fetchImpl:async()=>{if(fail)throw new Error('offline');return response(sample(clock));}});
  const live=await service.getSnapshot(); fail=true;clock+=6000;
  const stale=await service.getSnapshot();
  assert.equal(stale.status,'stale'); assert.deepEqual(stale.aircraft,live.aircraft);
  assert.equal(stale.sourceTime,start); assert.match(stale.error,/offline/);
});
test('no initial data yields unavailable and backs off repeated failures', async () => {
  let clock=start,calls=0;
  const service=createFeedService({now:()=>clock,providers:[primary],fetchImpl:async()=>{calls++;throw new Error('network');}});
  const first=await service.getSnapshot();
  assert.equal(first.status,'unavailable');assert.deepEqual(first.aircraft,[]);
  clock+=1000; await service.getSnapshot();assert.equal(calls,1);
  clock+=5000;const second=await service.getSnapshot();assert.equal(calls,2);assert.equal(second.retryAfterMs,10000);
});
test('malformed and old responses cannot be labeled live', async () => {
  for(const body of [{error:'bad'},sample(start-700000)]) {
    const service=createFeedService({now:()=>start,providers:[primary],fetchImpl:async()=>response(body)});
    assert.equal((await service.getSnapshot()).status,'unavailable');
  }
});
test('route lookup validates callsigns and coalesces repeated requests', async () => {
  let calls=0;
  const service=createRouteService({now:()=>start,fetchImpl:async()=>{calls++;return response({response:{flightroute:{callsign:'BAW213',callsign_iata:'BA213',origin:{iata_code:'LHR'},destination:{iata_code:'BOS'}}}});}});
  assert.equal((await service.get('../secret')).status,'invalid');assert.equal(calls,0);
  const [a,b]=await Promise.all([service.get('BAW213'),service.get('BAW213')]);
  assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.route.origin.iata,'LHR');
  await service.get('BAW213');assert.equal(calls,1);
});
test('missing route is explicit and cached; transient failures remain retryable', async () => {
  let calls=0;
  const unknown=createRouteService({fetchImpl:async()=>{calls++;return response({},404);}});
  assert.equal((await unknown.get('N123AB')).status,'unknown'); await unknown.get('N123AB');assert.equal(calls,1);
  const offline=createRouteService({fetchImpl:async()=>{throw new Error('offline');}});
  assert.equal((await offline.get('BAW213')).status,'unavailable');
});
