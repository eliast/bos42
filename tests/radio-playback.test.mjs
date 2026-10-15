import test from 'node:test';
import assert from 'node:assert/strict';
import {createRadioPlayback} from '../shared/radioPlayback.mjs';
class Player extends EventTarget{
  src='';paused=true;ended=false;currentTime=0;plays=[];error=null;
  getAttribute(name){return name==='src'?this.src:null;}
  removeAttribute(){this.src='';}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  load(){this.currentTime=0;this.ended=false;}
  play(){this.plays.push(this.src);if(this.error)return Promise.reject(this.error);this.paused=false;return Promise.resolve();}
  event(name){this.dispatchEvent(new Event(name));}
}
function setup(){
  const player=new Player(),timers=new Map(),states=[];let now=0,id=0;
  const radio=createRadioPlayback(player,{now:()=>now,onStatus:(...s)=>states.push(s),schedule:(f,ms)=>{timers.set(++id,{at:now+ms,f});return id;},cancel:id=>timers.delete(id)});
  const advance=ms=>{const end=now+ms;while(true){const entry=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;now=entry[1].at;timers.delete(entry[0]);entry[1].f();}now=end;};
  return{player,radio,states,timers,advance};
}
test('unexpected end, error and pause automatically reconnect the chosen station',()=>{
  for(const event of ['ended','error','pause']){
    const x=setup();x.radio.start('station-A');x.player.event('playing');
    if(event==='pause')x.player.paused=true;x.player.event(event);
    assert.deepEqual(x.states.at(-1),['retrying',2000]);x.advance(2000);
    assert.deepEqual(x.player.plays,['station-A','station-A']);x.radio.dispose();
  }
});
test('silent-but-advancing audio is healthy; frozen playback recovers after 25 seconds',()=>{
  const x=setup();x.radio.start('A');x.player.event('playing');
  for(let i=0;i<12;i++){x.player.currentTime+=5;x.advance(5000);}
  assert.equal(x.player.plays.length,1);
  x.advance(25000);assert.equal(x.states.at(-1)[0],'retrying');x.advance(2000);assert.equal(x.player.plays.length,2);x.radio.dispose();
});
test('repeated failures back off and deliberate stop or disposal cancels retry',()=>{
  const x=setup();x.radio.start('A');
  for(const delay of [2000,5000,10000,20000,30000,30000]){x.player.event('error');assert.deepEqual(x.states.at(-1),['retrying',delay]);x.advance(delay);}
  x.player.event('error');x.radio.stop();const count=x.player.plays.length;x.advance(120000);x.radio.recover();
  assert.equal(x.player.plays.length,count);assert.equal(x.timers.size,0);
  x.radio.start('B');x.player.event('error');x.radio.dispose();x.advance(60000);assert.equal(x.player.plays.at(-1),'B');assert.equal(x.timers.size,0);
});
test('station changes cancel the old retry and connectivity recovery retries only desired audio',()=>{
  const x=setup();x.radio.start('A');x.player.event('error');x.radio.start('B');x.advance(2000);
  assert.deepEqual(x.player.plays,['A','B']);x.player.event('error');x.radio.recover();assert.equal(x.player.plays.at(-1),'B');x.radio.dispose();
});
test('autoplay permission denial waits for a user gesture instead of retrying forever',async()=>{
  const x=setup();x.player.error={name:'NotAllowedError'};x.radio.start('A');await Promise.resolve();await Promise.resolve();
  assert.equal(x.states.at(-1)[0],'blocked');x.advance(120000);x.radio.recover();assert.equal(x.player.plays.length,1);
  x.player.error=null;x.radio.start('A');assert.equal(x.player.plays.length,2);x.radio.dispose();
});
test('a rejected old play promise cannot undo a new channel',async()=>{
  const x=setup();let reject;x.player.play=()=>new Promise((_,r)=>{reject=r;});x.radio.start('A');const oldReject=reject;
  x.player.play=Player.prototype.play;x.radio.start('B');oldReject({name:'AbortError'});await Promise.resolve();await Promise.resolve();
  assert.equal(x.player.src,'B');assert.equal(x.states.at(-1)[0],'connecting');x.radio.dispose();
});
