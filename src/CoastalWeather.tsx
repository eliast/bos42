import {useEffect,useState} from 'react';
import {apiUrl} from './api';
import {marineForecast,harborWaterLevel,marineAdvisories,tidePredictions} from '../shared/marineWeather.mjs';
import {TideDiagram} from './TideDiagram';
import './coastalWeather.css';

type Airport={observedAt:number;temperatureC:number|null;windDirection:number|'VRB'|null;windSpeedKts:number|null;windGustKts:number|null};
const time=(at:number)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(at);
const direction=(degrees:number|'VRB'|null)=>degrees==='VRB'?'Variable':degrees===null?'—':['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(degrees/22.5)%16];
export function CoastalWeather() {
  const [airport,setAirport]=useState<Airport|null>(null);
  const [forecast,setForecast]=useState<ReturnType<typeof marineForecast>>(null);
  const [tide,setTide]=useState<ReturnType<typeof harborWaterLevel>>(null);
  const [alerts,setAlerts]=useState<ReturnType<typeof marineAdvisories>>(null);
  const [predictions,setPredictions]=useState<ReturnType<typeof tidePredictions>>(null);
  const [failed,setFailed]=useState([false,false,false,false,false]);
  const [alertsAt,setAlertsAt]=useState(0),[loaded,setLoaded]=useState(false),[clock,setClock]=useState(Date.now());
  useEffect(()=>{
    let disposed=false,pending=false,controller:AbortController|null=null;
    const refresh=async()=>{
      if (document.hidden||pending) return;
      pending=true;controller=new AbortController();
      const timeout=setTimeout(()=>controller?.abort(),15000);
      const begin=new Date(Date.now()-86400000).toISOString().slice(0,10).replaceAll('-','');
      const urls=[apiUrl('/api/weather'),'https://api.weather.gov/zones/forecast/ANZ230/forecast','https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=8443970&product=water_level&datum=MLLW&time_zone=gmt&units=english&format=json','https://api.weather.gov/alerts/active?zone=ANZ230',`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&station=8443970&begin_date=${begin}&range=72&datum=MLLW&interval=hilo&time_zone=gmt&units=english&format=json`];
      const results=await Promise.allSettled(urls.map(async url=>{const response=await fetch(url,{signal:controller!.signal,cache:'no-store'});if(!response.ok)throw Error('Weather unavailable');return response.json();}));
      clearTimeout(timeout);pending=false;if(disposed)return;
      const failures=[false,false,false,false,false];
      results.forEach((r,i)=>{
        if(r.status==='rejected'){failures[i]=true;return;}
        if(i===0){const a=r.value?.report;if(a?.station==='KBOS'&&Number.isFinite(a.observedAt)){setAirport(a);failures[i]=r.value.status!=='available';}else failures[i]=true;}
        if(i===1){const f=marineForecast(r.value);if(f)setForecast(f);else failures[i]=true;}
        if(i===2){const t=harborWaterLevel(r.value);if(t)setTide(t);else failures[i]=true;}
        if(i===4){const p=tidePredictions(r.value);if(p?.length)setPredictions(p);else failures[i]=true;}
        if(i===3){const a=marineAdvisories(r.value,Date.now());if(a){setAlerts(a);setAlertsAt(Date.now());}else failures[i]=true;}
      });
      setFailed(failures);setLoaded(true);setClock(Date.now());
    };
    void refresh();const refreshTimer=setInterval(()=>void refresh(),300000),clockTimer=setInterval(()=>setClock(Date.now()),30000);
    const visible=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',visible);
    return()=>{disposed=true;controller?.abort();clearInterval(refreshTimer);clearInterval(clockTimer);document.removeEventListener('visibilitychange',visible);};
  },[]);
  const oldAirport=failed[0]||!!airport&&(clock-airport.observedAt>5400000||airport.observedAt-clock>300000);
  const oldForecast=failed[1]||!!forecast&&(clock-forecast.updatedAt>64800000||forecast.updatedAt-clock>300000);
  const oldTide=failed[2]||!!tide&&(clock-tide.at>1800000||tide.at-clock>300000);
  const oldAlerts=failed[3]||clock-alertsAt>1200000;
  const activeAlerts=alerts?.filter(a=>a.expires>clock)||[];
  return <aside id="coastal-weather" className="coastal-weather" aria-label="NOAA weather for Logan and Boston Harbor">
    <div className="coastal-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 8q3-3 6 0t6 0 6 0M2 14q3-3 6 0t6 0 6 0M2 20q3-3 6 0t6 0 6 0"/></svg><strong>Logan + Boston Harbor</strong></div>
    <section><div className="coastal-label"><b>LOGAN</b><span>{airport?`${time(airport.observedAt)}${oldAirport?' · LAST REPORT':''}`:loaded?'Unavailable':'Connecting…'}</span></div>
      <div className="coastal-airport">
        <div className="coastal-temperature"><strong>{airport?.temperatureC!=null?Math.round(airport.temperatureC*9/5+32):'—'}</strong><span>°F</span><small>Temperature</small></div>
        <div className="coastal-wind"><div className="coastal-wind-main"><svg className="coastal-wind-dial" viewBox="0 0 40 40" aria-label={`Wind from ${direction(airport?.windDirection ?? null)}`}><circle cx="20" cy="20" r="17" fill="none" stroke="#9dbdc63d"/><path d="M20 3v4M37 20h-4M20 37v-4M3 20h4" stroke="#9dbdc670"/>{typeof airport?.windDirection==='number'&&<path d="m20 9-5 17 5-3 5 3Z" transform={`rotate(${airport.windDirection} 20 20)`} fill="#badbdd"/>}</svg><strong>{airport?.windSpeedKts!=null?Math.round(airport.windSpeedKts):'—'}</strong><span>kt</span></div><small>{airport?.windSpeedKts===0?'Calm':direction(airport?.windDirection ?? null)}{airport?.windGustKts!=null?` · gust ${Math.round(airport.windGustKts)} kt`:''}</small></div>
      </div>
    </section>
    <section><div className="coastal-label"><b>HARBOR FORECAST</b><span>{forecast?`${forecast.period}${oldForecast?' · OLD':''}`:loaded?'Unavailable':'Connecting…'}</span></div><p className="coastal-forecast">{forecast?.text||'Waiting for the Boston Harbor marine forecast.'}</p>
      <div className="coastal-tide"><span>Water level</span><b>{tide?`${tide.feet.toFixed(1)} ft MLLW`:'—'}</b><small>{tide?`${time(tide.at)}${oldTide?' · OLD':''}`:'Unavailable'}</small></div>
      <TideDiagram predictions={predictions} now={clock} cached={failed[4]}/>
    </section>
    <div className={`coastal-alerts ${activeAlerts.length?'has-advisory':''}`}>{activeAlerts.length?`${oldAlerts?'Last report: ':''}${[...new Set(activeAlerts.map(a=>a.event))].join(' · ')}`:alerts&&!oldAlerts?'No marine advisories reported':loaded?'Marine advisories unavailable':'Checking marine advisories…'}</div>
    <small className="coastal-source">NOAA / NWS · KBOS · ANZ230 · Boston tide gauge</small>
  </aside>;
}
