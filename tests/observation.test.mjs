import test from 'node:test';
import assert from 'node:assert/strict';
import {arrivalQueue,aircraftSpotlights,directorScene} from '../shared/observation.mjs';
import {bearing} from '../shared/aviation.mjs';
const now=1000000;
const plane=(id,extra={})=>({id,label:id,operator:'Test airline',aircraftType:'A320',lat:42.4,lon:-71.01,heading:bearing({lat:42.4,lon:-71.01},{lat:42.3656,lon:-71.0096}),headingKnown:true,speedKnown:true,speedKts:120,distanceNm:4,ground:false,phase:'Likely arrival',observedAt:now,...extra});
test('arrival queue estimates closing time and sorts by time rather than raw distance',()=>{
  const queue=arrivalQueue([plane('slow'),plane('fast',{speedKts:240,distanceNm:5})],now);
  assert.equal(queue[0].aircraft.id,'fast');assert.equal(Math.round(queue[0].seconds),75);
  assert.equal(Math.round(queue[1].seconds),120);
});
test('does not invent an ETA for unknown speed, unknown heading, or an aircraft moving away',()=>{
  for(const extra of [{speedKnown:false},{headingKnown:false},{heading:0},{speedKts:0}])assert.equal(arrivalQueue([plane('a',extra)],now)[0].seconds,null);
});
test('arrival estimates exclude stale, future, ground, departing and distant tracks',()=>{
  for(const extra of [{observedAt:now-21000},{observedAt:now+1},{ground:true},{phase:'Climbing'},{distanceNm:31},{distanceNm:NaN}])assert.equal(arrivalQueue([plane('a',extra)],now).length,0);
});
test('spotlights prioritize unusual aircraft and ignore stale reports',()=>{
  const list=aircraftSpotlights([plane('ordinary'),plane('wide',{aircraftType:'B789'}),plane('jumbo',{aircraftType:'A388'}),plane('stale',{aircraftType:'B744',observedAt:now-21000})],now);
  assert.deepEqual(list.map(x=>x.aircraft.id),['jumbo','wide']);
});
test('director alternates aircraft, scenery, moving vessels and avoids immediate repeats',()=>{
  const a=plane('jumbo',{aircraftType:'A388'}),b=plane('arrival');
  const vessel={id:'ship',name:'Test ship',observedAt:now,speedKts:5,lengthM:120,stale:false};
  assert.equal(directorScene([a,b],[vessel],now,0).id,'jumbo');
  assert.equal(directorScene([a,b],[vessel],now,1).view,'Runways');
  assert.equal(directorScene([a,b],[vessel],now,2).kind,'vessel');
  assert.equal(directorScene([a,b],[vessel],now,4,new Map([['aircraft:jumbo',now]])).id,'arrival');
  assert.equal(directorScene([],[],now,0).kind,'scenic');
  assert.equal(directorScene([],[{...vessel,observedAt:now-21000}],now,2).kind,'scenic');
});

test('Director includes the apartment window scene even without live traffic',()=>{
  const scene=directorScene([],[],now,6);
  assert.equal(scene.view,'Apartment');
  assert.equal(scene.label,'Your window · Floor 42');
  assert.equal(directorScene([],[],now,14).view,'Apartment');
});

test('Director visits Traffic then returns to live scenes, alternating arrivals and harbor',()=>{
  const vessels=[{id:'boat',observedAt:now,speedKts:5,stale:false}];
  assert.equal(directorScene([],vessels,now,7).filter,'arrivals');
  assert.equal(directorScene([plane('a')],vessels,now,8).kind,'aircraft');
  assert.equal(directorScene([],vessels,now,15).filter,'harbor');
  assert.equal(directorScene([],[],now,15).filter,'arrivals');
});
