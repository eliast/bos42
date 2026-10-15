import { useEffect, useRef, useState } from 'react';
import type { Vessel } from './harborTypes';
import { vesselStaleAfter } from '../shared/marine.mjs';
import './harbor.css';
export const vesselName = (v: Vessel) => v.name || `MMSI ${v.mmsi}`;
export const vesselAge = (v: Vessel, now: number) => Math.max(0, Math.floor((now-v.observedAt)/1000));
export const vesselIsStale = (v: Vessel, now: number) => now-v.observedAt > vesselStaleAfter(v);
const ageText = (age: number) => age<60?`${age}s ago`:`${Math.floor(age/60)}m ago`;
export function VesselCard({vessel,now,interrupted}:{vessel:Vessel;now:number;interrupted:boolean}) {
  const stale=interrupted||vesselIsStale(vessel,now);
  return <section className="flight-card vessel-card" aria-label="Selected vessel">
    <div className="flight-identity">
      <div className="identity-top"><div className="phase-label">{stale?'LAST POSITION':'BOSTON HARBOR'} · {ageText(vesselAge(vessel,now))}</div></div>
      <div className="vessel-name">{vesselName(vessel)}</div>
      <div className="airline-name">{vessel.label}</div>
      <div className="vessel-status">{vessel.navigationLabel || (vessel.speedKts!==null&&vessel.speedKts>.5?'Moving':'AIS position')}</div>
      {vessel.destination&&<div className="route-block"><div className="route-direction">REPORTED DESTINATION</div><div className="route-cities">{vessel.destination}</div></div>}
    </div>
  </section>;
}
export function VesselTicker({vessel,now,interrupted}:{vessel:Vessel;now:number;interrupted:boolean}) {
  const group=useRef<HTMLSpanElement>(null), [duration,setDuration]=useState(50);
  const facts=[{label:'Vessel',text:vesselName(vessel)},{label:'Type',text:vessel.label}];
  if(vessel.lengthM!==null)facts.push({label:'Length',text:`${vessel.lengthM} m · ${Math.round(vessel.lengthM*3.28084)} ft`});
  if(vessel.widthM!==null)facts.push({label:'Beam',text:`${vessel.widthM} m wide`});
  if(vessel.draftM!==null)facts.push({label:'Reported draft',text:`${vessel.draftM.toFixed(1)} m below the waterline`});
  if(vessel.destination)facts.push({label:'Reported destination',text:vessel.destination});
  if(vessel.eta){const e=vessel.eta;facts.push({label:'Reported ETA',text:`${e.month}/${e.day} ${String(e.hour).padStart(2,'0')}:${String(e.minute).padStart(2,'0')} UTC · crew-entered`});}
  if(vessel.callsign)facts.push({label:'Callsign',text:vessel.callsign});
  facts.push({label:'MMSI',text:vessel.mmsi});
  if(vessel.imo)facts.push({label:'IMO',text:String(vessel.imo)});
  facts.push({label:'AISStream',text:interrupted?'Updates interrupted':`Position ${ageText(vesselAge(vessel,now))}`});
  useEffect(()=>{const node=group.current;if(!node)return;const measure=()=>setDuration(Math.max(35,node.getBoundingClientRect().width/32));const observer=new ResizeObserver(measure);observer.observe(node);measure();return()=>observer.disconnect();},[]);
  return <section className="flight-ticker" aria-label="Selected vessel information"><p className="sr-only">{facts.map(f=>`${f.label}: ${f.text}`).join('. ')}</p><div className="ticker-viewport" tabIndex={0} aria-label="Vessel facts"><span className="ticker-track" aria-hidden="true" style={{'--ticker-duration':`${duration}s`} as React.CSSProperties}>{[0,1].map(copy=><span className="ticker-group" key={copy} ref={copy===0?group:undefined}>{facts.map(f=><span className="ticker-fact" key={f.label}><b>{f.label}</b><span>{f.text}</span><i>·</i></span>)}</span>)}</span></div></section>;
}
