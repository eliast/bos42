import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeJourney,delayText} from '../shared/journey.mjs';
import {createJourneyService} from '../server/journey.mjs';
import {createApp} from '../server/app.mjs';

const now=Date.parse('2026-10-04T17:00:00Z');
const aircraft={id:'abc123',callsign:'AAL42',registration:'N123AA',ground:false,observedAt:now};
const flight={fa_flight_id:'today',ident:'AAL42',ident_icao:'AAL42',registration:'N123AA',origin:{code_icao:'KMIA',code_iata:'MIA',city:'Miami',timezone:'America/New_York'},destination:{code_icao:'KBOS',code_iata:'BOS',city:'Boston',timezone:'America/New_York'},scheduled_out:'2026-10-04T14:00:00Z',actual_out:'2026-10-04T14:28:00Z',actual_off:'2026-10-04T14:42:00Z',scheduled_on:'2026-10-04T17:00:00Z',estimated_on:'2026-10-04T17:06:00Z',scheduled_in:'2026-10-04T17:10:00Z',estimated_in:'2026-10-04T17:15:00Z'};
const body={flights:[flight],links:{next:null}};
test('matches the active leg and keeps runway and gate events distinct',()=>{
  const result=normalizeJourney({flights:[{...flight,fa_flight_id:'tomorrow',actual_off:null,actual_out:null},flight]},aircraft,now);
  assert.equal(result.flightId,'today');assert.equal(result.departureDelayMinutes,28);assert.equal(result.arrivalDelayMinutes,5);assert.equal(result.arrivalReference,'gate');assert.equal(result.arrivalIsEstimate,true);
  assert.equal(result.times.actual_off,Date.parse(flight.actual_off));assert.equal(result.times.estimated_on,Date.parse(flight.estimated_on));assert.equal(result.times.actual_on,null);
});
test('rejects another tail, ambiguous legs, already-landed airborne matches, and future actual times',()=>{
  assert.equal(normalizeJourney(body,{...aircraft,registration:'N999AA'},now),null);
  assert.equal(normalizeJourney({flights:[flight,{...flight,fa_flight_id:'other'}]},aircraft,now),null);
  assert.equal(normalizeJourney({flights:[{...flight,actual_on:'2026-10-04T16:59:00Z'}]},aircraft,now),null);
  assert.equal(normalizeJourney({flights:[{...flight,actual_off:'2026-10-04T18:00:00Z'}]},aircraft,now),null);
  assert.equal(normalizeJourney({flights:[{...flight,actual_off:'2026-10-04T14:00:00'}]},aircraft,now),null);
});
test('late arrivals from yesterday still match and delays can be negative',()=>{
  const result=normalizeJourney({flights:[{...flight,actual_out:'2026-10-03T22:58:00Z',scheduled_out:'2026-10-03T23:00:00Z',actual_off:'2026-10-03T23:10:00Z'}]},aircraft,now);
  assert.equal(result.departureDelayMinutes,-2);assert.equal(delayText(-2),'2 min early');assert.equal(delayText(0),'On time');assert.equal(delayText(null),null);
});
test('recurrence counts route-matched operating days once, labels partial pages, handles local dates',()=>{
  const history=Array.from({length:7},(_,i)=>({...flight,fa_flight_id:`old${i}`,registration:'NOTHER',actual_off:`2026-10-${String(3-i||30).padStart(2,'0')}T15:00:00Z`}));
  // Use valid September/October dates and include one UTC date that is the previous local day.
  history.forEach((f,i)=>f.actual_off=new Date(now-(i+1)*86400000).toISOString());
  const result=normalizeJourney({flights:[flight,...history,history[0],{...history[0],destination:{code_icao:'KJFK'}}],links:{next:'/next'}},aircraft,now);
  assert.equal(result.frequency.count,7);assert.equal(result.frequency.days.length,7);assert.equal(result.frequency.partial,true);
  const midnight=normalizeJourney({flights:[flight,{...history[0],actual_off:'2026-10-04T01:00:00Z'}]},aircraft,now);
  assert.equal(midnight.frequency.days.find(d=>d.date==='2026-10-03').operated,true);
});
test('schedule requests coalesce, cache by callsign, bound cost, and never return secrets',async()=>{
  let requests=0;let clock=now;let lastUrl;
  const service=createJourneyService({key:'TEST-PRIVATE-KEY',dailyLimit:1,now:()=>clock,fetchImpl:async(url,options)=>{requests++;lastUrl=url;assert.equal(options.headers['x-apikey'],'TEST-PRIVATE-KEY');return{ok:true,json:async()=>body};}});
  const [a,b]=await Promise.all([service.get(aircraft),service.get(aircraft)]);
  assert.equal(requests,1);assert.equal(a.status,'found');assert.deepEqual(a,b);assert.equal(lastUrl.searchParams.get('max_pages'),'1');assert.equal(lastUrl.searchParams.get('ident_type'),'designator');
  assert.equal((await service.get({...aircraft,registration:'NWRONG'})).status,'unknown');assert.equal(requests,1);
  clock+=600001;assert.equal((await service.get(aircraft)).status,'budget_limit');assert.equal(requests,1);assert.equal(JSON.stringify(a).includes('TEST-PRIVATE'),false);
});
test('unconfigured and rejected provider access stay explicit, bounded and sanitized',async()=>{
  const empty=createJourneyService({key:'',fetchImpl:()=>assert.fail('must not fetch')});assert.equal((await empty.get(aircraft)).status,'unconfigured');
  let requests=0;
  const denied=createJourneyService({key:'secret',now:()=>now,fetchImpl:async()=>{requests++;return{ok:false,status:401};}});
  assert.equal((await denied.get(aircraft)).status,'access_required');await denied.get({...aircraft,callsign:'DAL1'});assert.equal(requests,1);
});
test('journey endpoint only looks up a fresh aircraft already in the live feed',async t=>{
  let queries=0;
  const app=createApp({feed:{getSnapshot:async()=>({status:'live',serverTime:now,aircraft:[aircraft]})},journeys:{get:async a=>{queries++;assert.equal(a.id,'abc123');return{status:'unconfigured',journey:null};}}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await(await fetch(`${base}/api/journey/not-seen`)).json()).status,'invalid');
  assert.equal((await(await fetch(`${base}/api/journey/ffffee`)).json()).status,'unavailable');assert.equal(queries,0);
  assert.equal((await(await fetch(`${base}/api/journey/abc123`)).json()).status,'unconfigured');assert.equal(queries,1);
});
