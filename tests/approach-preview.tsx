import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MapView} from '../src/MapView';
import {ApproachViews} from '../src/ApproachViews';
import {createRadioPlayback,type RadioPlayback} from '../shared/radioPlayback.mjs';
import {DEFAULT_PREFERENCES} from '../src/config';
import {demoFeed} from '../src/demo';
import {LOGAN,destination} from '../shared/aviation.mjs';
import {approachViews,type ApproachTrack} from '../shared/approaches.mjs';
import '../src/styles.css';

const started=Date.now();
const tracks:ApproachTrack[]=[45,180,225].flatMap((bearing,i)=>[0,1,2,3,4,5,6,7].map(n=>({
  key:`${i}-${n}`,id:`test${i}${n}`,callsign:'DEMO',label:'SIMULATED',color:['#db354d','#f8d13b','#64b6e9'][i],
  points:Array.from({length:70},(_,j)=>({...destination(LOGAN,bearing+n*.7+Math.sin(j/17)*9,Math.max(100,11000-j*160)),altitudeFt:Math.max(30,3200-j*46),at:started-((70-j)*5+n*65)*1000,ground:false})),
})));
function Preview(){
  const[liveTracks,setLiveTracks]=useState<ApproachTrack[]|null>(null);
  const[view,setView]=useState('NE'),[follow,setFollow]=useState(false),[sample,setSample]=useState(()=>demoFeed().aircraft[0]);
  const audio=useRef<HTMLAudioElement>(null),radio=useRef<RadioPlayback|null>(null),clip=useRef('');
  const[radioStatus,setRadioStatus]=useState('stopped');
  useEffect(()=>{
    const data=new ArrayBuffer(44+16000*60*2),wav=new DataView(data);
    const word=(at:number,s:string)=>[...s].forEach((c,i)=>wav.setUint8(at+i,c.charCodeAt(0)));
    word(0,'RIFF');wav.setUint32(4,data.byteLength-8,true);word(8,'WAVE');word(12,'fmt ');wav.setUint32(16,16,true);wav.setUint16(20,1,true);wav.setUint16(22,1,true);wav.setUint32(24,16000,true);wav.setUint32(28,32000,true);wav.setUint16(32,2,true);wav.setUint16(34,16,true);word(36,'data');wav.setUint32(40,data.byteLength-44,true);
    clip.current=URL.createObjectURL(new Blob([data],{type:'audio/wav'}));
    radio.current=createRadioPlayback(audio.current!,{onStatus:state=>setRadioStatus(state)});
    return()=>{radio.current?.dispose();URL.revokeObjectURL(clip.current);};
  },[]);
  useEffect(()=>{const timer=setInterval(()=>setSample(demoFeed().aircraft[0]),5000);return()=>clearInterval(timer);},[]);
  const current=Date.now(),views=approachViews(liveTracks||tracks.map(t=>({...t,points:t.points.map(p=>({...p,at:p.at+current-started}))})),current),active=views.find(v=>v.id===view)||views[0];
  return <div className="app"><main className="airspace">
    <MapView aircraft={[sample]} selectedId={follow?sample.id:null} mode={follow?'follow':'explore'} scenicView={follow?null:'Runways'} approachView={active} approachTracks={follow?[]:active?.tracks||[]} vessels={[]} selectedVesselId={null} preferences={DEFAULT_PREFERENCES} clockOffset={0} onSelect={()=>setFollow(true)} onSelectVessel={()=>{}} onExplore={()=>{}} onLocate={()=>setFollow(true)} onWindowZoom={()=>{}}/>
    <div style={{position:'absolute',top:16,left:16,zIndex:20,background:'#102630',padding:12,display:'flex',gap:10,alignItems:'center'}}><b>{liveTracks?"RECORDED HISTORY QA":"SIMULATED QA"}</b><button onClick={()=>{void fetch("/api/approaches").then(r=>r.json()).then(h=>setLiveTracks(h.tracks));}}>Show recorded history</button><button onClick={()=>setFollow(v=>!v)}>{follow?'Show approach history':'Follow simulated plane'}</button><button onClick={()=>radio.current?.start(clip.current)}>Start silent media test</button><button onClick={()=>audio.current?.pause()}>Interrupt playback</button><button onClick={()=>radio.current?.stop()}>Stop playback</button><output aria-label="Radio recovery status">{radioStatus}</output></div>
    {!follow&&<ApproachViews views={views} activeId={active?.id||null} source={liveTracks?"server":"demo"} onSelect={v=>setView(v.id)}/>}
    <audio ref={audio} loop/>
  </main><footer className="app-footer">Development fixture · {liveTracks?'recorded approaches with a simulated aircraft':'synthetic tracks'} · silent audio for recovery testing</footer></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
