import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticSelection, nextLikelyArrival, watchFlight } from '../shared/selection.mjs';
const now=1791035000000;
const plane=(id,overrides={})=>({id,observedAt:now,ground:false,distanceNm:2,altitudeFt:900,verticalRateFpm:-600,phase:'Likely arrival',...overrides});

test('next likely arrival is the nearest fresh airborne approach', () => {
  const traffic = [plane('old', {distanceNm: .3, observedAt: now - 21000}), plane('ground', {distanceNm: .4, ground: true}), plane('climbing', {distanceNm: .5, phase: 'Climbing'}), plane('far', {distanceNm: 8}), plane('next', {distanceNm: 3})];
  assert.equal(nextLikelyArrival(traffic, now)?.id, 'next');
  assert.equal(nextLikelyArrival([plane('old', {observedAt: now - 21000})], now), null);
});

test('arrival selection retains a flight when it levels off on short final',()=>{
  const previous={id:'a',arrival:true,groundSince:null};
  assert.equal(automaticSelection([plane('a',{phase:'Airborne',verticalRateFpm:0}),plane('b',{distanceNm:1.8})],previous,now).id,'a');
});
test('a first ground report remains selected for twelve seconds',()=>{
  const traffic=[plane('a',{ground:true}),plane('b')];
  const selected=automaticSelection(traffic,{id:'a',arrival:true,groundSince:null},now);
  assert.equal(selected.id,'a'); assert.equal(selected.groundSince,now);
  assert.equal(automaticSelection(traffic,selected,now+11000).id,'a');
  assert.equal(automaticSelection(traffic,selected,now+13000).id,'b');
});
test('go-arounds, disappearing tracks and old positions release the selection',()=>{
  const previous={id:'a',arrival:true,groundSince:null};
  assert.equal(automaticSelection([plane('a',{phase:'Climbing',verticalRateFpm:1200}),plane('b')],previous,now).id,'b');
  assert.equal(automaticSelection([plane('b')],previous,now).id,'b');
  assert.equal(automaticSelection([plane('a',{observedAt:now-30000})],previous,now).id,null);
});

test('a tapped flight stays in auto through approach and landing, then hands off', () => {
  const tapped = plane('chosen', {distanceNm: 12, altitudeFt: 5000, phase: 'Airborne'});
  const next = plane('next', {distanceNm: 1});
  let state = watchFlight(tapped, now);
  state = automaticSelection([tapped, next], state, now);
  assert.equal(state.id, 'chosen', 'a closer arrival must not override the tap');
  state = automaticSelection([plane('chosen', {ground: true}), next], state, now);
  assert.equal(state.id, 'chosen');
  assert.equal(automaticSelection([plane('chosen', {ground: true}), next], state, now + 11000).id, 'chosen');
  state = automaticSelection([plane('chosen', {ground: true}), next], state, now + 13000);
  assert.equal(state.id, 'next');
  assert.ok(!state.pinned, 'normal arrival selection resumes after landing');
});

test('a tapped flight that leaves coverage releases to the next fresh arrival', () => {
  const state = watchFlight(plane('chosen'), now);
  assert.equal(automaticSelection([plane('next')], state, now).id, 'next');
  assert.equal(automaticSelection([plane('chosen', {observedAt: now - 30000}), plane('next')], state, now).id, 'next');
});
