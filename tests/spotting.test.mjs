import test from 'node:test';
import assert from 'node:assert/strict';
import {destination} from '../shared/aviation.mjs';
import {pickSpotting,sightline,relativeDirection,spottingReason} from '../shared/spotting.mjs';
const now=Date.now(),home={lat:42.35,lon:-71.05,altitudeM:165,bearing:80};
const a={id:'one',callsign:'BAW1',operator:'British Airways',aircraftType:'B772',phase:'Likely arrival',ground:false,altitudeFt:4000,observedAt:now,...destination(home,80,8000)};
const pick=(items,extra={})=>pickSpotting(items,{home,now,selectedId:null,...extra});
test('prioritizes a double-decker over a nearer wide-body and skips the selected flight',()=>{
  const jumbo={...a,id:'two',aircraftType:'A388',...destination(home,90,12000)};
  assert.equal(pick([a,jumbo]).aircraft.id,'two');assert.equal(pick([a,jumbo],{selectedId:'two'}).aircraft.id,'one');
});
test('does not alert on stale/future/ground/off-window/distant/departing aircraft',()=>{
  for(const update of [{observedAt:now-16000},{observedAt:now+1000},{ground:true},{...destination(home,260,8000)},{...destination(home,80,50000)},{phase:'Climbing'}])assert.equal(pick([{...a,...update}]),null);
});
test('deduplicates the same aircraft and callsign for 30 minutes',()=>{
  assert.equal(pick([a],{seen:new Map([['one:BAW1',now-1000]])}),null);
  assert.ok(pick([a],{seen:new Map([['one:BAW1',now-1800001]])}));
});
test('directions wrap north and reference real window bearing',()=>{
  const eastOfNorth={...a,...destination(home,5,8000)};const line=sightline(eastOfNorth,home,355);
  assert.ok(Math.abs(line.delta-10)<.01);assert.equal(relativeDirection(line.delta),'10° right');assert.equal(relativeDirection(-40),'40° left');assert.equal(relativeDirection(2),'Straight ahead');
});
test('private classification needs operator evidence and helicopter can be nearby without arrival inference',()=>{
  assert.equal(spottingReason({...a,callsign:'N12345',aircraftType:'C172'}),null);
  assert.equal(spottingReason({...a,callsign:'EJA42',aircraftType:'C68A'}).reason,'Private / charter operator');
  assert.ok(pick([{...a,callsign:'N42',aircraftType:'R44',phase:'Cruising'}]));
});
