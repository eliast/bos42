import {readFileSync} from 'node:fs';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {routeFitsAircraft} from '../shared/aviation.mjs';
const DAY=86400000,ZONE='America/New_York';
const localDay=t=>new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(t);
const minutes=t=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,hourCycle:'h23',hour:'2-digit',minute:'2-digit'}).formatToParts(t);return Number(p.find(v=>v.type==='hour').value)*60+Number(p.find(v=>v.type==='minute').value);};
const airport=a=>a?{code:a.iata||a.icao,icao:a.icao,city:a.municipality||a.name}:null;
const isBOS=a=>a?.icao==='KBOS'||a?.iata==='BOS';
const routeKey=r=>r?.origin?.icao&&r?.destination?.icao?`${r.origin.icao}:${r.destination.icao}`:null;

// Learns only from the existing local ADS-B feed and cached adsbdb routes.
// No scheduled times, future assignments or inferred exact touchdown times.
export function createFlightStoryService({routes,now=Date.now,storagePath=process.env.FLIGHT_STORY_PATH||(process.env.RAILWAY_VOLUME_MOUNT_PATH?path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH,'flight-story.json'):null)}={}) {
  let records=[],startedAt=now(),timer=null,dirty=false,writing=null,persistence=storagePath?'pending':'memory';
  const coverage=new Set(),pending=new Set();
  let windowStart=now(),requests=0;
  if(storagePath)try{
    const saved=JSON.parse(readFileSync(storagePath,'utf8'));
    if(saved.version!==1||!Array.isArray(saved.records))throw new Error('Unsupported history');
    records=saved.records.filter(r=>r&&typeof r.id==='string'&&typeof r.callsign==='string'&&['arrival','departure'].includes(r.direction)&&Number.isFinite(r.firstSeen)&&Number.isFinite(r.lastSeen)&&Number.isFinite(r.nearAt)&&r.lastSeen>now()-35*DAY&&r.lastSeen<=now()).slice(-40000);
    startedAt=Number.isFinite(saved.startedAt)?saved.startedAt:now();
    for(const d of saved.coverage||[])if(/^\d{4}-\d{2}-\d{2}$/.test(d))coverage.add(d);
    persistence='saved';
  }catch(error){if(error.code!=='ENOENT')console.error('Flight story: history could not be loaded');}
  function prune(){records=records.filter(r=>r.lastSeen>now()-35*DAY).slice(-40000);for(const d of coverage)if(d<localDay(now()-35*DAY))coverage.delete(d);}
  async function flush(){
    if(writing)return writing;
    if(!storagePath||!dirty)return;
    dirty=false;prune();
    const payload=JSON.stringify({version:1,startedAt,coverage:[...coverage],records});
    writing=(async()=>{try{await mkdir(path.dirname(storagePath),{recursive:true});await writeFile(`${storagePath}.tmp`,payload,{mode:0o600});await rename(`${storagePath}.tmp`,storagePath);persistence='saved';}catch{dirty=true;persistence='error';console.error('Flight story: history could not be saved');}finally{writing=null;}})();
    return writing;
  }
  function enrich(record,a){
    if(record.route||pending.has(record.key)||now()<(record.retryAt||0))return;
    if(now()-windowStart>=60000){windowStart=now();requests=0;}
    if(pending.size>=2||requests>=20)return;
    pending.add(record.key);requests++;record.retryAt=now()+600000;
    void routes.get(a.callsign).then(value=>{
      const route=value.route;
      if(routeFitsAircraft(route,a)&&(record.direction==='arrival'?isBOS(route.destination):isBOS(route.origin))){record.route={origin:airport(route.origin),destination:airport(route.destination)};dirty=true;}
    }).catch(()=>{}).finally(()=>pending.delete(record.key));
  }
  function ingest(aircraft,time=now()){
    coverage.add(localDay(time));dirty=true;
    for(const a of aircraft){
      if(!/^[A-Z0-9]{2,10}$/.test(a.callsign||'')||a.ground||time-a.observedAt<0||time-a.observedAt>=20000||a.distanceNm>8||a.altitudeFt>6500)continue;
      const direction=a.phase==='Likely arrival'?'arrival':a.phase==='Climbing'?'departure':null;
      if(!direction)continue;
      let record=records.findLast(r=>r.id===a.id&&r.callsign===a.callsign&&r.direction===direction&&time-r.lastSeen<90*60000&&(!a.registration||!r.registration||a.registration===r.registration));
      if(!record){record={key:`${a.id}:${a.callsign}:${direction}:${time}`,id:a.id,callsign:a.callsign,label:a.label,registration:a.registration||null,direction,firstSeen:time,lastSeen:time,nearAt:time,minDistance:a.distanceNm,route:null};records.push(record);if(records.length>40000)prune();}
      record.lastSeen=time;if(a.registration)record.registration=a.registration;
      if(a.distanceNm<record.minDistance){record.minDistance=a.distanceNm;record.nearAt=time;}
      enrich(record,a);
    }
  }
  function nextDeparture(arrival){
    if(!arrival.registration)return null;
    const later=records.filter(r=>r.registration===arrival.registration&&r.firstSeen>arrival.lastSeen&&r.firstSeen<arrival.lastSeen+12*3600000).sort((a,b)=>a.firstSeen-b.firstSeen);
    // An intervening arrival means this is another visit, not a direct turnaround.
    const next=later[0];return next?.direction==='departure'&&next.route&&next.route.origin?.icao==='KBOS'?next:null;
  }
  return {ingest,flush,
    start(){if(!timer){timer=setInterval(()=>void flush(),60000);timer.unref?.();}},
    async stop(){clearInterval(timer);timer=null;await flush();if(dirty)await flush();},
    status(){return{startedAt,observations:records.length,persistence,source:'Observed ADS-B + adsbdb routes'};},
    get(a){
      prune();const today=localDay(now());
      const current=records.findLast(r=>r.id===a.id&&r.callsign===a.callsign&&now()-r.lastSeen<2*3600000&&(!a.registration||!r.registration||a.registration===r.registration));
      const rk=routeKey(current?.route);
      const matches=rk?records.filter(r=>r.callsign===a.callsign&&r.direction===current.direction&&routeKey(r.route)===rk):[];
      const days=[...new Set(Array.from({length:16},(_,i)=>localDay(now()-(i+1)*12*3600000)))].filter(d=>d<today).sort().slice(-7);
      const past=matches.filter(r=>days.includes(localDay(r.nearAt)));
      const seen=new Set(past.map(r=>localDay(r.nearAt)));
      const samples=[...new Map(past.map(r=>[localDay(r.nearAt),minutes(r.nearAt)])).values()];
      let usualTime=null;
      if(samples.length>=2){const pivot=samples[0],values=samples.map(m=>pivot+((m-pivot+2160)%1440-720)).sort((a,b)=>a-b);usualTime={from:(values[0]+1440)%1440,to:(values.at(-1)+1440)%1440,samples:samples.length};}
      const turnarounds=matches.filter(r=>r.direction==='arrival').map(r=>({arrival:r,departure:nextDeparture(r)})).filter(x=>x.departure);
      const destinations=new Map();
      for(const {departure} of turnarounds){const d=departure.route.destination;if(!d?.icao)continue;const old=destinations.get(d.icao);destinations.set(d.icao,{destination:d,count:(old?.count||0)+1});}
      const leg=r=>r?{callsign:r.label||r.callsign,registration:r.registration,destination:r.route.destination,observedAt:r.nearAt}:null;
      const prior=a.registration?turnarounds.filter(x=>x.arrival.registration===a.registration&&x.arrival.key!==current?.key).sort((a,b)=>b.arrival.nearAt-a.arrival.nearAt)[0]:null;
      return {status:current?'found':'collecting',source:'Observed ADS-B + adsbdb routes',retrievedAt:now(),startedAt,persistence,flight:current?{callsign:current.label||current.callsign,registration:current.registration,direction:current.direction,observedAt:current.nearAt,route:current.route}:null,
        pattern:rk?{days:days.map(date=>({date,seen:seen.has(date),watched:coverage.has(date)})),daysSeen:seen.size,usualTime,timezone:ZONE}:null,
        turnaround:{observedNext:current?.direction==='arrival'?leg(nextDeparture(current)):null,previousVisitNext:prior?leg(prior.departure):null,destinations:[...destinations.values()].sort((a,b)=>b.count-a.count).slice(0,3),samples:turnarounds.length},
      };
    },
  };
}
