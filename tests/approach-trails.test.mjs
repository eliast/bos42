import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {buildApproachGeometry,MAX_GHOST_TRACKS} from '../src/ApproachTrails.ts';
import {APPROACH_WINDOW_MS} from '../shared/approaches.mjs';
const now=1792068000000;
const point=(x,y=0,at=now)=>({lat:42+y/111000,lon:-71+x/83000,altitudeFt:1000,at,ground:false});
const project=p=>new Vector3((p.lon+71)*83000,(p.lat-42)*111000,p.altitudeFt);
const track=(points,key='a')=>({key,id:key,callsign:key,label:key,color:'#ffe000',points});
const alphaValues=geometry=>Array.from({length:geometry.getAttribute('color').count},(_,i)=>geometry.getAttribute('color').getW(i));

test('ghosts preserve missing-report gaps, reject bad data and skip tiny fragments',()=>{
  const geometry=buildApproachGeometry([track([
    point(0,0,now-60000),point(400,0,now-55000),
    {...point(5000,0,now-20000),breakBefore:true},point(5400,0,now-15000),
    {...point(6000),lat:NaN},point(7000,0,now-5000),point(7001,0,now)
  ])],now,project);
  const vertices=geometry.getAttribute('position'),indices=geometry.index;
  assert.ok(indices.count>0);
  for(let i=0;i<indices.count;i+=3){
    const xs=[0,1,2].map(j=>vertices.getX(indices.getX(i+j)));
    assert.ok(Math.max(...xs)-Math.min(...xs)<150);
    assert.ok(Math.max(...xs)<=401||Math.min(...xs)>=4999&&Math.max(...xs)<=5401);
  }
  geometry.dispose();
});
test('ghost ends dissolve, age reduces opacity to zero, and curves stay finite',()=>{
  const recorded=track([point(0,0,now-20000),point(400,180,now-15000),point(800,210,now-10000),point(1200,180,now-5000)]);
  const fresh=buildApproachGeometry([recorded],now,project),old=buildApproachGeometry([recorded],now+700000,project);
  const alpha=alphaValues(fresh),oldAlpha=alphaValues(old);
  assert.equal(alpha[0],0);
  assert.equal(alpha.at(-1),0);
  assert.ok(Math.max(...alpha)>.3&&Math.max(...alpha)<=.58);
  assert.ok(Math.max(...oldAlpha)<Math.max(...alpha));
  for(const name of ['position','previous','next'])assert.ok([...fresh.getAttribute(name).array].every(Number.isFinite));
  const expired=buildApproachGeometry([recorded],now+APPROACH_WINDOW_MS,project);assert.equal(expired.index.count,0);
  fresh.dispose();old.dispose();expired.dispose();
});
test('only the latest six tracks appear and smoothing does not change recorded history',()=>{
  const tracks=Array.from({length:10},(_,i)=>track([point(0,i*1000,now-(10-i)*10000-5000),point(400,i*1000,now-(10-i)*10000)],String(i)));
  const original=JSON.stringify(tracks);
  const geometry=buildApproachGeometry(tracks,now,project);
  const starts=geometry.getAttribute('position');
  const lanes=new Set(Array.from({length:starts.count},(_,i)=>Math.round(starts.getY(i)/1000)));
  assert.equal(lanes.size,MAX_GHOST_TRACKS);assert.deepEqual([...lanes].sort(),[4,5,6,7,8,9]);
  assert.equal(JSON.stringify(tracks),original);
  geometry.dispose();
});
