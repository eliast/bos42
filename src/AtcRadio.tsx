import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import './atc.css';
import {createRadioPlayback,type RadioPlayback,type RadioStatus} from '../shared/radioPlayback.mjs';

// Official feed/frequency mapping: https://www.liveatc.net/search/?icao=KBOS
const CHANNELS = [
  {key:'APP',name:'Final Approach',frequency:'126.500',feed:'kbos1_app_fin1'},
  {key:'TWR W',name:'Tower West',frequency:'128.800',feed:'kbos1_twr_128800'},
  {key:'TWR E',name:'Tower East',frequency:'132.225',feed:'kbos1_twr_132225'},
  {key:'GND',name:'Ground',frequency:'121.900',feed:'kbos1_gnd_121900'},
  {key:'DEP',name:'Departure',frequency:'133.000',feed:'kbos1_dep_133000'},
  {key:'ATIS',name:'ATIS',frequency:'135.000',feed:'kbos1_atis'},
] as const;
export interface AtcRadioHandle { play: () => void; }

export function RadioIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 13v-2a8 8 0 0 1 16 0v2M20 17v1a3 3 0 0 1-3 3h-4"/><rect x="2" y="11" width="4" height="7" rx="2"/><rect x="18" y="11" width="4" height="7" rx="2"/><path d="M10 21h3"/></svg>;
}

export const AtcRadio = forwardRef<AtcRadioHandle,{callsign?:string;onClose:()=>void}>(function AtcRadio({onClose},ref) {
  const tuneButton=useRef<HTMLButtonElement>(null);
  const audio=useRef<HTMLAudioElement>(null);
  const playback=useRef<RadioPlayback|null>(null);
  const tuning=useRef<{x:number;y:number;channel:number}|null>(null);
  const suppressTuneClick=useRef(false);
  const [channel,setChannel]=useState<number>(0);
  const selected=CHANNELS[channel];
  const [status,setStatus]=useState<RadioStatus>('stopped');
  const [retryDelay,setRetryDelay]=useState(0);
  const controller=()=>{
    if(!playback.current&&audio.current)playback.current=createRadioPlayback(audio.current,{onStatus:(state,delay)=>{setStatus(state);setRetryDelay(delay);}});
    return playback.current;
  };
  const play=(next=channel)=>{
    setChannel(next);controller()?.start(`https://d.liveatc.net/${CHANNELS[next].feed}`);
  };
  useImperativeHandle(ref,()=>({play:()=>play(0)}));
  useEffect(()=>{
    if(!playback.current)play(0);
    const online=()=>playback.current?.recover();
    const visible=()=>{if(!document.hidden)online();};
    window.addEventListener('online',online);document.addEventListener('visibilitychange',visible);
    return()=>{window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visible);playback.current?.dispose();playback.current=null;};
  },[]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&document.activeElement?.closest('#atc-radio'))onClose();};
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('keydown',escape);if(document.activeElement?.closest('#atc-radio'))previous?.focus();};
  },[]);
  return <aside id="atc-radio" className="atc-panel" role="region" aria-labelledby="atc-title">
    <header className="atc-heading"><h2 id="atc-title">COM <span>01</span></h2><span className={`atc-live ${status==='playing'?'is-live':''}`}><i/>{status==='playing'?'LIVE':status==='connecting'?'TUNING':status==='retrying'?'RETRY':'OFF'}</span></header>
    <div className="atc-tuning"><div className="atc-frequency"><span>{selected.name.toUpperCase()}</span><strong>{selected.frequency}<small>MHz</small></strong></div><button ref={tuneButton} className="atc-tune-knob" aria-label={`Tune radio: ${selected.name}, ${selected.frequency} MHz. Tap for next station or use arrow keys.`} title="Tap for next station, or drag to tune" style={{'--tune-angle':`${channel*60-150}deg`} as React.CSSProperties}
      onPointerDown={event=>{tuning.current={x:event.clientX,y:event.clientY,channel};suppressTuneClick.current=false;event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerCancel={()=>{tuning.current=null;suppressTuneClick.current=true;}}
      onPointerUp={event=>{const origin=tuning.current;tuning.current=null;if(!origin)return;const delta=(event.clientX-origin.x)+(origin.y-event.clientY);if(Math.abs(delta)>=12){suppressTuneClick.current=true;const step=Math.round(delta/24)||Math.sign(delta);play(((origin.channel+step)%CHANNELS.length+CHANNELS.length)%CHANNELS.length);}}}
      onClick={()=>{if(suppressTuneClick.current){suppressTuneClick.current=false;return;}play(status==='playing'||status==='connecting'?(channel+1)%CHANNELS.length:channel);}}
      onKeyDown={event=>{if(['ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();play((channel+(event.key==='ArrowLeft'?-1:1)+CHANNELS.length)%CHANNELS.length);}}}><span aria-hidden="true"/></button></div>
    <audio ref={audio} preload="none" playsInline/>
    <footer className="atc-foot"><span className="atc-play-status" role="status">{status==='playing'?'Listening':status==='connecting'?'Connecting…':status==='blocked'?'Press knob to listen':status==='retrying'?`Auto retry in ${retryDelay/1000}s`:'Tap or drag to tune'}</span><span>LiveATC.net</span></footer>
  </aside>;
});
