import {useEffect,useRef,useState} from 'react';
import type {Aircraft,Route} from './types';
import type {JourneyResult} from './journeyTypes';
import {apiUrl} from './api';
import {delayText} from '../shared/journey.mjs';
import './timeline.css';

const time=(value:number|null|undefined)=>value==null?'—':new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(value);
const missing=(status:string)=>({unconfigured:'Schedule data is not connected yet.',access_required:'The schedule provider needs account access.',budget_limit:'Today’s schedule lookup limit has been reached.',unknown:'No matching flight leg was found.',unavailable:'Schedule details are temporarily unavailable.',busy:'The schedule provider is busy.',demo:'Sample flight · no live schedule lookup.'}[status] || 'Looking up this flight…');
const empty:JourneyResult={status:'loading',journey:null,source:'FlightAware AeroAPI',retrievedAt:null};
const clientCache=new Map<string,{result:JourneyResult;at:number}>();

export function FlightTimeline({aircraft,route,now,demo,onClose}:{aircraft:Aircraft;route:Route|null;now:number;demo:boolean;onClose:()=>void}) {
  const identity=`${aircraft.id}:${aircraft.callsign}:${aircraft.registration||''}`;
  const [lookup,setLookup]=useState<{id:string;result:JourneyResult}>({id:identity,result:empty});
  useEffect(()=>{
    const set=(result:JourneyResult)=>setLookup({id:identity,result});
    if(demo){set({...empty,status:'demo'});return;}
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function load(){
      if(document.hidden){timer=setTimeout(load,10000);return;}
      const hit=clientCache.get(identity);
      if(hit&&Date.now()-hit.at<600000){set(hit.result);timer=setTimeout(load,60000);return;}
      try{
        const response=await fetch(apiUrl(`/api/journey/${encodeURIComponent(aircraft.id)}`),{signal:controller.signal,cache:'no-store'});
        if(!response.ok)throw new Error('Schedule unavailable');
        const value=await response.json() as JourneyResult;
        if(!value||typeof value.status!=='string'||!('journey' in value))throw new Error('Invalid schedule');
        if(!controller.signal.aborted){set(value);clientCache.set(identity,{result:value,at:Date.now()});if(clientCache.size>100)clientCache.delete(clientCache.keys().next().value!);}
      }catch{if(!controller.signal.aborted)set({...empty,status:'unavailable'});}
      if(!controller.signal.aborted)timer=setTimeout(load,60000);
    }
    set(empty);void load();return()=>{controller.abort();clearTimeout(timer);};
  },[identity,demo,aircraft.id]);
  return <JourneyPanel aircraft={aircraft} route={route} now={now} result={lookup.id===identity?lookup.result:empty} onClose={onClose}/>;
}

export function JourneyPanel({aircraft,route,now,result,onClose}:{aircraft:Aircraft;route:Route|null;now:number;result:JourneyResult;onClose:()=>void}) {
  const close=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',escape);return()=>{document.removeEventListener('keydown',escape);previous?.focus();};},[]);
  const j=result.journey;
  const stale=!!result.retrievedAt&&now-result.retrievedAt>15*60000;
  const origin=j?.origin?.city||route?.origin?.municipality||route?.origin?.iata;
  const destination=j?.destination?.city||route?.destination?.municipality||route?.destination?.iata;
  const times=j?.times||{};
  const elapsed=times.actual_off!=null?Math.max(0,Math.floor(((times.actual_on??now)-times.actual_off)/60000)):null;
  const arrival=times.actual_on??times.estimated_on;
  const departureDelay=j?delayText(j.departureDelayMinutes):null;
  const arrivalDelay=j?delayText(j.arrivalDelayMinutes,j.arrivalIsEstimate):null;
  return <section className="flight-timeline" role="dialog" aria-modal="false" aria-labelledby="timeline-title">
    <header><div><small>THIS FLIGHT</small><h2 id="timeline-title">{aircraft.label} · Timeline</h2></div><button ref={close} onClick={onClose} aria-label="Close flight timeline">×</button></header>
    <div className="journey-route">{origin||'Origin unavailable'}<span>→</span>{destination||'Destination unavailable'}</div>
    {!j&&<p className="journey-notice" role="status">{missing(result.status)} {result.status==='unconfigured'&&'Takeoff time, delay and weekly frequency need a schedule feed.'}</p>}
    <ol className="journey-events">
      <li className={times.actual_out?'complete':''}><i/><div><span>Left the gate</span><strong>{time(times.actual_out)}</strong><small>{times.scheduled_out?`Scheduled ${time(times.scheduled_out)}`:'Scheduled time unavailable'}{departureDelay&&j?.departureReference==='gate'?` · ${departureDelay}`:''}</small></div></li>
      <li className={times.actual_off?'complete':''}><i/><div><span>Takeoff</span><strong>{time(times.actual_off)}</strong><small>{elapsed!==null?`${elapsed} min ${times.actual_on?'airborne':'since takeoff'}`:'Takeoff time unavailable'}{departureDelay&&j?.departureReference==='runway'?` · ${departureDelay}`:''}</small></div></li>
      <li className="current"><i/><div><span>{now-aircraft.observedAt>20000?'Last reported':'Now'}</span><strong>{aircraft.phase}</strong><small>{aircraft.distanceNm.toFixed(1)} NM from Logan · position {Math.max(0,Math.floor((now-aircraft.observedAt)/1000))}s ago</small></div></li>
      <li className={times.actual_on?'complete':''}><i/><div><span>{times.actual_on?'Landed':'Expected landing'}</span><strong>{time(arrival)}</strong><small>{times.scheduled_on?`Scheduled ${time(times.scheduled_on)}`:'Landing time unavailable'}{arrivalDelay&&j?.arrivalReference==='runway'?` · ${arrivalDelay}`:''}</small></div></li>
      {(times.scheduled_in||times.actual_in||times.estimated_in)&&<li><i/><div><span>{times.actual_in?'At the gate':'Expected at gate'}</span><strong>{time(times.actual_in??times.estimated_in)}</strong><small>{times.scheduled_in?`Scheduled ${time(times.scheduled_in)}`:''}{arrivalDelay&&j?.arrivalReference==='gate'?` · ${arrivalDelay}`:''}</small></div></li>}
    </ol>
    {j&&<div className="journey-frequency"><strong>{j.frequency.partial?'At least ':''}{j.frequency.count} of the past 7 days recorded</strong><div className="frequency-week">{j.frequency.days.map(d=><span key={d.date} className={d.operated?'operated':''} title={`${d.date}: ${d.operated?'departure recorded':'no departure in returned data'}`}><i/>{new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'UTC'}).format(new Date(`${d.date}T12:00:00Z`))}</span>)}</div><small>Same flight and route · {j.frequency.partial?'partial history · ':''}past departures, not a future timetable.</small></div>}
    <footer>All times Boston local · {j?<><a href="https://www.flightaware.com/commercial/aeroapi/" target="_blank" rel="noreferrer">FlightAware</a> · {stale?'older schedule snapshot':`checked ${Math.max(0,Math.floor((now-result.retrievedAt!)/60000))} min ago`}</>:'Schedule times remain blank until verified.'}</footer>
  </section>;
}
