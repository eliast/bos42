import {useEffect,useRef,useState} from 'react';
import type {Aircraft,WindowView} from './types';
import {pickSpotting,relativeDirection,sightline,type Spotting} from '../shared/spotting.mjs';
import './spotter.css';

let chimeContext:AudioContext|null=null;
export function enableSpotterSound(){
  try{chimeContext??=new AudioContext();void chimeContext.resume().catch(()=>{});}catch{/* Sound is optional. */}
}
function chime(){
  const context=chimeContext;if(!context||context.state!=='running')return;
  for(const [i,frequency] of [659,880].entries()){
    const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime+i*.16;
    oscillator.frequency.value=frequency;oscillator.type='sine';gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.035,at+.025);gain.gain.exponentialRampToValueAtTime(.001,at+.25);
    oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at);oscillator.stop(at+.26);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
}

export function Spotter({aircraft,home,now,selectedId,enabled,visible,sound,view,onFollow}:{aircraft:Aircraft[];home:WindowView;now:number;selectedId:string|null;enabled:boolean;visible:boolean;sound:boolean;view:{bearing:number;aligned:boolean};onFollow:(id:string)=>void}){
  const [active,setActive]=useState<{spot:Spotting;until:number}|null>(null);
  const seen=useRef(new Map<string,number>()),lastAlert=useRef(-Infinity),started=useRef(now);
  const current=active?aircraft.find(a=>a.id===active.spot.aircraft.id&&a.callsign===active.spot.aircraft.callsign):null;
  const expired=!current||current.ground||now-current.observedAt>15000||now<current.observedAt||now>(active?.until??0);
  useEffect(()=>{
    if(!enabled||!visible||document.hidden){if(active)setActive(null);return;}
    if(active){if(expired||current?.id===selectedId)setActive(null);return;}
    if(now-started.current<10000||now-lastAlert.current<90000)return;
    const spot=pickSpotting(aircraft,{home,now,selectedId,seen:seen.current});if(!spot)return;
    seen.current.set(`${spot.aircraft.id}:${spot.aircraft.callsign}`,now);lastAlert.current=now;
    for(const [id,t]of seen.current)if(now-t>1800000)seen.current.delete(id);
    setActive({spot,until:now+25000});if(sound)chime();
  },[aircraft,home,now,selectedId,enabled,visible,sound,active,expired,current]);
  useEffect(()=>{if(!sound)return;const unlock=()=>enableSpotterSound();window.addEventListener('pointerdown',unlock,{once:true});return()=>window.removeEventListener('pointerdown',unlock);},[sound]);
  if(!enabled||!visible||!active||expired||!current)return null;
  const line=sightline(current,home,view.bearing);
  return <aside className="spotter-alert" aria-label="Aircraft worth spotting" style={{'--spot-color':current.color} as React.CSSProperties}>
    <button className="spotter-follow" onClick={()=>{onFollow(current.id);setActive(null);}} aria-label={`Follow ${current.label}, ${active.spot.reason}`}>
      <svg viewBox="0 0 32 32" className="spotter-arrow" style={{transform:`rotate(${line.delta}deg)`}} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m7 17 9-10 9 10M16 7v20"/></svg>
      <span><small>LOOK OVER THERE</small><strong>{current.label} · {active.spot.reason}</strong><span>{relativeDirection(line.delta)} · {line.range.toFixed(1)} NM away</span><em>{view.aligned?'Approximate sightline':'Direction approximate · align Window'} · tap to follow</em></span>
    </button><button className="spotter-dismiss" onClick={()=>setActive(null)} aria-label="Dismiss spotting alert">×</button>
  </aside>;
}
