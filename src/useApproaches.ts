import {useEffect,useRef,useState} from 'react';
import {createApproachHistory,type ApproachHistory} from '../shared/approaches.mjs';
import type {Aircraft} from './types';
import {apiUrl} from './api';

export function useApproaches(aircraft:Aircraft[],now:number,demo:boolean,live:boolean) {
  const recorder=useRef(createApproachHistory());
  const [local,setLocal]=useState<ApproachHistory>(()=>recorder.current.snapshot(now));
  const [remote,setRemote]=useState<ApproachHistory|null>(null);
  const previousDemo=useRef(demo);
  useEffect(()=>{
    if(previousDemo.current!==demo){recorder.current=createApproachHistory({now:()=>now});previousDemo.current=demo;setRemote(null);}
    if(live)recorder.current.ingest(aircraft,now);
    setLocal(recorder.current.snapshot(now));
  },[aircraft,demo,live]);
  useEffect(()=>{
    if(demo)return;
    let cancelled=false,timer:ReturnType<typeof setTimeout>,controller:AbortController|null=null;
    const poll=async()=>{
      if(cancelled)return;
      if(document.hidden){timer=setTimeout(poll,10000);return;}
      controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);
      try{
        const response=await fetch(apiUrl('/api/approaches'),{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error('History unavailable');
        const value=await response.json() as ApproachHistory;
        if(!Array.isArray(value.tracks)||value.tracks.length>96||!Number.isFinite(value.serverTime)||value.tracks.some(t=>!Array.isArray(t.points)||t.points.length>200))throw new Error('Invalid history');
        if(!cancelled)setRemote(value);
      }catch{/* Retain a recent snapshot; timestamps expire old trails. */}
      finally{clearTimeout(timeout);controller=null;if(!cancelled)timer=setTimeout(poll,10000);}
    };
    const visible=()=>{if(!document.hidden&&!controller){clearTimeout(timer);void poll();}};
    document.addEventListener('visibilitychange',visible);void poll();
    return()=>{cancelled=true;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',visible);};
  },[demo]);
  const serverRecent=!demo&&remote&&now-remote.serverTime<30000&&now>=remote.serverTime-5000;
  return {history:serverRecent?remote:local,source:demo?'demo':serverRecent?'server':'session'} as const;
}
