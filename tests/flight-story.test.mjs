import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createFlightStoryService} from '../server/flightStory.mjs';
import {createApp} from '../server/app.mjs';
const base=Date.parse('2026-10-14T20:00:00Z'),DAY=86400000;
const bos={icao:'KBOS',iata:'BOS',municipality:'Boston'},tpa={icao:'KTPA',iata:'TPA',municipality:'Tampa'},jfk={icao:'KJFK',iata:'JFK',municipality:'New York'};
const a=(time,extra={})=>({id:'abc123',callsign:'JBU42',label:'B642',registration:'N123JB',ground:false,observedAt:time,distanceNm:3,altitudeFt:1500,phase:'Likely arrival',...extra});
const routes={get:async callsign=>({route:{callsign,origin:callsign==='JBU42'?tpa:bos,destination:callsign==='JBU42'?bos:jfk}})};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('learns repeat operating days and near-Logan time without calling a paid provider',async()=>{
 let clock=base-3*DAY;const s=createFlightStoryService({routes,now:()=>clock,storagePath:null});
 for(let i=0;i<3;i++){s.ingest([a(clock,{registration:`N${i}JB`})],clock);await settle();s.ingest([a(clock+5000,{registration:`N${i}JB`,distanceNm:2})],clock+5000);clock+=DAY;}
 s.ingest([a(clock)],clock);await settle();const result=s.get(a(clock));
 assert.equal(result.pattern.daysSeen,3);assert.equal(result.pattern.days.length,7);assert.equal(result.pattern.usualTime.samples,3);assert.equal(result.flight.route.origin.code,'TPA');assert.equal(result.flight.direction,'arrival');assert.equal(result.turnaround.observedNext,null);
 assert.equal('scheduled' in result,false);assert.match(result.source,/Observed/);
});
test('links the same tail only after a later Boston departure is actually observed',async()=>{
 let clock=base-DAY;const s=createFlightStoryService({routes,now:()=>clock,storagePath:null});
 s.ingest([a(clock)],clock);await settle();clock+=3600000;
 s.ingest([a(clock,{id:'other',callsign:'JBU99',registration:'N999JB',phase:'Climbing'})],clock);await settle();
 assert.equal(s.get(a(clock)).turnaround.observedNext,null);
 s.ingest([a(clock,{callsign:'JBU99',phase:'Climbing'})],clock);await settle();
 let result=s.get(a(clock,{callsign:'JBU42'}));assert.equal(result.turnaround.observedNext.destination.code,'JFK');
 clock=base;s.ingest([a(clock)],clock);await settle();result=s.get(a(clock));
 assert.equal(result.turnaround.observedNext,null);assert.equal(result.turnaround.previousVisitNext.destination.code,'JFK');assert.equal(result.turnaround.samples,1);
});
test('does not link across an intervening visit or an incompatible route',async()=>{
 let clock=base;const s=createFlightStoryService({routes,now:()=>clock,storagePath:null});
 s.ingest([a(clock)],clock);await settle();clock+=2*3600000;s.ingest([a(clock,{callsign:'JBU77'})],clock);await settle();clock+=3600000;s.ingest([a(clock,{callsign:'JBU99',phase:'Climbing'})],clock);await settle();
 const result=s.get(a(clock));assert.equal(result.turnaround.observedNext,null);
 const wrong=createFlightStoryService({routes:{get:async callsign=>({route:{callsign,origin:bos,destination:jfk}})},now:()=>clock,storagePath:null});wrong.ingest([a(clock)],clock);await settle();assert.equal(wrong.get(a(clock)).flight.route,null);
});
test('rejects stale, ground and overflying aircraft and bounds free route work',async()=>{
 let calls=0;const s=createFlightStoryService({routes:{get:async()=>{calls++;return{route:null};}},now:()=>base,storagePath:null});
 s.ingest([a(base,{observedAt:base-20000}),a(base,{ground:true}),a(base,{distanceNm:12}),a(base,{phase:'Airborne'})],base);assert.equal(s.status().observations,0);
 s.ingest(Array.from({length:30},(_,i)=>a(base,{id:`a${i}`,callsign:`JBU${i}`})),base);await settle();assert.ok(calls<=2);assert.equal(s.status().observations,30);
});
test('history survives restart and expires after retention period',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bos42-history-'));t.after(()=>rm(dir,{recursive:true,force:true}));const storagePath=path.join(dir,'history.json');
 const s=createFlightStoryService({routes,now:()=>base,storagePath});s.ingest([a(base)],base);await settle();await s.flush();assert.equal(s.status().persistence,'saved');
 const restored=createFlightStoryService({routes,now:()=>base+DAY,storagePath});assert.equal(restored.status().observations,1);assert.equal(restored.get(a(base+DAY)).status,'collecting');
 const expired=createFlightStoryService({routes,now:()=>base+36*DAY,storagePath});assert.equal(expired.status().observations,0);
});
test('story endpoint serves only fresh tracked aircraft without paid journey calls',async t=>{
 let queried=0;const app=createApp({feed:{getSnapshot:async()=>({status:'live',serverTime:base,aircraft:[a(base)]})},journeys:{get:()=>assert.fail('No paid calls')},stories:{get:()=>{queried++;return{status:'found'};},status:()=>({observations:1})}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const url=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await(await fetch(`${url}/api/flight-story/abc123`)).json()).status,'found');assert.equal(queried,1);
 assert.equal((await(await fetch(`${url}/api/flight-story/ffffee`)).json()).status,'unavailable');assert.equal(queried,1);
 assert.equal((await(await fetch(`${url}/api/flight-story/status`)).json()).observations,1);
});
