import {useEffect,useState} from 'react';
import {apiUrl} from './api';
import type {Aircraft} from './types';
type StoryAirport={code:string;icao:string;city:string};
type Story={status:string;flight?:{route:{origin:StoryAirport;destination:StoryAirport}|null;direction:string}|null;pattern?:{daysSeen:number;usualTime:{from:number;to:number;samples:number}|null;timezone:string}|null;turnaround?:{observedNext:{destination:StoryAirport}|null;previousVisitNext:{destination:StoryAirport;observedAt:number}|null;destinations:{destination:StoryAirport;count:number}[];samples:number}};
const cache=new Map<string,{at:number;story:Story}>();
const clock=(m:number)=>`${m%720<60?12:Math.floor(m%720/60)}:${String(m%60).padStart(2,'0')} ${m<720?'AM':'PM'}`;
export function FlightStory({aircraft}:{aircraft:Aircraft}){
  const identity=`${aircraft.id}:${aircraft.callsign}:${aircraft.registration||''}`;
  const [value,setValue]=useState<{id:string;story:Story}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function load(){
      const hit=cache.get(identity);
      if(hit&&Date.now()-hit.at<30000){setValue({id:identity,story:hit.story});}
      else if(!document.hidden)try{
        const response=await fetch(apiUrl(`/api/flight-story/${encodeURIComponent(aircraft.id)}`),{signal:controller.signal});
        if(!response.ok)throw new Error('Flight story unavailable');
        const story=await response.json() as Story;
        if(!controller.signal.aborted){cache.set(identity,{at:Date.now(),story});if(cache.size>100)cache.delete(cache.keys().next().value!);setValue({id:identity,story});}
      }catch{/* No empty/error card when the flight story is not available. */}
      if(!controller.signal.aborted)timer=setTimeout(load,30000);
    }
    void load();return()=>{controller.abort();clearTimeout(timer);};
  },[identity,aircraft.id]);
  const s=value?.id===identity?value.story:null;
  if(s?.status!=='found'||!s.flight?.route)return null;
  const {origin,destination}=s.flight.route,p=s.pattern,t=s.turnaround;
  const top=t?.destinations[0];
  return <div className="flight-story" aria-label="What we have learned about this flight">
    <strong>{origin.code} → {destination.code}</strong>
    {p&&p.daysSeen>0&&<p>Seen on {p.daysSeen} of the past 7 days{p.usualTime?` · usually near Logan ${clock(p.usualTime.from)}–${clock(p.usualTime.to)} Boston time`:''}.</p>}
    {t?.observedNext?<p>This tail later departed for <b>{t.observedNext.destination.city||t.observedNext.destination.code}</b>.</p>:t?.previousVisitNext?<p>On a previous visit, this tail later departed for <b>{t.previousVisitNext.destination.city||t.previousVisitNext.destination.code}</b>.</p>:top&&t&&t.samples>=2?<p>After this flight, aircraft were later seen departing for <b>{top.destination.code}</b> on {top.count} of {t.samples} linked visits.</p>:null}
    <small>Observed flights · route from adsbdb</small>
  </div>;
}
