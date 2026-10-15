import test from 'node:test';
import assert from 'node:assert/strict';
import {createApproachHistory,approachViews,chooseApproachView,approachSegments,APPROACH_WINDOW_MS} from '../shared/approaches.mjs';
import {LOGAN,destination,bearing} from '../shared/aviation.mjs';
import {directorScene} from '../shared/observation.mjs';
import {createFeedService} from '../server/feed.mjs';
const start=1792000000000;
function plane(id,angle,time,distance=5000,extra={}){
  const p=destination(LOGAN,angle,distance);
  return{id,callsign:id,label:id,color:'#FFE000',...p,altitudeFt:1500,observedAt:time,ground:false,phase:'Likely arrival',headingKnown:true,heading:bearing(p,LOGAN),...extra};
}
function recorded(angles=[45,225]){
  const recorder=createApproachHistory({now:()=>start});
  for(let i=0;i<5;i++)recorder.ingest(angles.map((d,n)=>plane(`p${n}`,d,start+i*5000,6000-i*300)),start+i*5000);
  return recorder.snapshot(start+20000).tracks;
}
test('history retains observed arrivals after disappearance, then expires them by age',()=>{
  let now=start;const h=createApproachHistory({now:()=>now});
  h.ingest([plane('a',45,now)]);now+=5000;h.ingest([plane('a',45,now,4700)]);
  h.ingest([],now+60000);assert.equal(h.snapshot().tracks[0].points.length,2);
  now+=APPROACH_WINDOW_MS+1;assert.equal(h.snapshot().tracks.length,0);
});
test('rejects stale, future, departing, unknown-direction, malformed and distant entrants',()=>{
  const h=createApproachHistory({now:()=>start});
  for(const extra of [{observedAt:start-21000},{observedAt:start+1},{ground:true},{phase:'Climbing'},{headingKnown:false},{heading:45},{lat:NaN},{altitudeFt:12000}])h.ingest([plane('a',45,start,5000,extra)]);
  h.ingest([plane('far',45,start,40000)]);
  assert.equal(h.snapshot().tracks.length,0);
});
test('does not duplicate reports, join gaps or keep taxiing after the first ground report',()=>{
  const h=createApproachHistory({now:()=>start});
  h.ingest([plane('a',45,start)]);h.ingest([plane('a',45,start)],start+1000);
  h.ingest([plane('a',45,start+5000,4700)],start+5000);
  h.ingest([plane('a',45,start+40000,2200)],start+40000);
  h.ingest([plane('a',45,start+45000,2100,{ground:true,altitudeFt:20})],start+45000);
  h.ingest([plane('a',45,start+50000,2000,{ground:true,altitudeFt:20})],start+50000);
  const tracks=h.snapshot(start+50000).tracks;
  assert.equal(tracks[0].points.length,4);assert.equal(tracks[0].points[2].breakBefore,true);
  assert.equal(approachSegments(tracks,start+50000).length,2);
});
test('bounds memory and separates reused aircraft identities',()=>{
  const h=createApproachHistory({now:()=>start,maxTracks:2,maxPoints:3});
  for(let i=0;i<6;i++)h.ingest([plane('a',45,start+i*5000,6000-i*200)],start+i*5000);
  h.ingest([plane('a',45,start+30000,4500,{callsign:'NEW'})],start+30000);
  assert.equal(h.snapshot(start+30000).tracks.length,2);
  h.ingest([plane('b',225,start+35000)],start+35000);
  const tracks=h.snapshot(start+35000).tracks;assert.equal(tracks.length,2);assert.ok(tracks.every(t=>t.points.length<=3));
});
test('groups observed entry directions, handles north wrap and cycles each active direction',()=>{
  const tracks=recorded([358,2,225]);const views=approachViews(tracks,start+20000);
  assert.deepEqual(views.map(v=>[v.id,v.count]),[['N',2],['SW',1]]);
  const seen=new Map();const first=chooseApproachView(tracks,start+20000,seen);seen.set(`approach:${first.id}`,start+20000);
  assert.equal(chooseApproachView(tracks,start+20000,seen).id,'SW');
  const scene=directorScene([],[],start+20000,1,seen,tracks);
  assert.equal(scene.view,'Runways');assert.equal(scene.approach.id,'SW');
  assert.equal(chooseApproachView(tracks,start+APPROACH_WINDOW_MS+30000),null);
});
test('fades only historical observed segments, without joining position jumps',()=>{
  const tracks=recorded([45]);const recent=approachSegments(tracks,start+20000),old=approachSegments(tracks,start+700000);
  assert.ok(recent[0].opacity>old[0].opacity);
  tracks[0].points[2].breakBefore=true;
  assert.equal(approachSegments(tracks,start+20000).length,recent.length-1);
});
test('feed history shares provider reads with live viewers',async()=>{
  let now=start,calls=0;
  const service=createFeedService({now:()=>now,providers:[{id:'test',url:'https://example.invalid',name:'test'}],fetchImpl:async()=>{
    calls++;const p=plane('abc123',225,now,5000-(now-start)/20);
    return{ok:true,json:async()=>({now,ac:[{hex:'abc123',flight:'TST1',lat:p.lat,lon:p.lon,alt_geom:1500,gs:150,track:p.heading,baro_rate:-700,seen_pos:0}]})};
  }});
  await Promise.all([service.getSnapshot(),service.getSnapshot()]);assert.equal(calls,1);
  now+=5000;await service.getSnapshot();const h=service.getApproachHistory();
  assert.equal(h.tracks[0].points.length,2);assert.equal(calls,2);
  service.getApproachHistory();assert.equal(calls,2);
});
