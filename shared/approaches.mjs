import {LOGAN, distanceNm, bearing, angleDifference, destination} from './aviation.mjs';

export const APPROACH_WINDOW_MS = 15 * 60 * 1000;
const directions = ['North','Northeast','East','Southeast','South','Southwest','West','Northwest'];
const codes = ['N','NE','E','SE','S','SW','W','NW'];
const validPoint = p => [p.lat,p.lon,p.altitudeFt,p.at].every(Number.isFinite) && Math.abs(p.lat)<=90 && Math.abs(p.lon)<=180;

// Keep only observed positions, never extrapolated tracks or invented landings.
export function createApproachHistory({now=Date.now, maxTracks=96, maxPoints=200}={}) {
  const tracks = new Map();
  const startedAt = now();
  let lastObservationAt = null;
  function prune(time) {
    for (const [key,track] of tracks) {
      track.points = track.points.filter(p=>p.at>time-APPROACH_WINDOW_MS && p.at<=time).slice(-maxPoints);
      if (!track.points.length) tracks.delete(key);
    }
    const oldest = [...tracks.values()].sort((a,b)=>a.points.at(-1).at-b.points.at(-1).at);
    while (tracks.size>maxTracks) tracks.delete(oldest.shift().key);
  }
  return {
    ingest(aircraft, time=now()) {
      prune(time);
      for (const a of aircraft) {
        const point = {lat:a.lat,lon:a.lon,altitudeFt:a.altitudeFt,at:a.observedAt,ground:!!a.ground};
        if (!validPoint(point)||time-point.at<0||time-point.at>20000||point.altitudeFt>7000||point.altitudeFt< -200) continue;
        const range = distanceNm(point,LOGAN);
        if (range>15 || point.ground && range>2) continue;
        let track = [...tracks.values()].reverse().find(t=>t.id===a.id && t.callsign===(a.callsign||'') && point.at-t.points.at(-1).at<120000);
        const last = track?.points.at(-1);
        if (last && (point.at<=last.at || last.ground)) continue;
        if (!track) {
          const inbound = a.phase==='Likely arrival' && !point.ground && a.headingKnown!==false && Number.isFinite(a.heading) && Math.abs(angleDifference(a.heading,bearing(point,LOGAN)))<55;
          if (!inbound) continue;
          const key = `${a.id}:${a.callsign||''}:${point.at}`;
          track = {key,id:a.id,callsign:a.callsign||'',label:a.label||a.id,color:/^#[0-9a-f]{6}$/i.test(a.color)?a.color:'#b7cbd2',points:[]};
          tracks.set(key,track);
        }
        if (last && point.at-last.at<4000 && !point.ground) continue;
        if (last) point.breakBefore = point.at-last.at>25000 || distanceNm(last,point)>Math.max(.25,(point.at-last.at)/3600000*550);
        track.points.push(point);
        lastObservationAt = Math.max(lastObservationAt||0,point.at);
      }
      prune(time);
    },
    snapshot(time=now()) {
      prune(time);
      return {windowMs:APPROACH_WINDOW_MS,startedAt,lastObservationAt,serverTime:time,tracks:[...tracks.values()].map(t=>({...t,points:t.points.map(p=>({...p}))}))};
    },
  };
}

export function approachViews(tracks, now) {
  const groups = new Map();
  for (const track of tracks) {
    const points = track.points.filter(p=>validPoint(p) && p.at>now-APPROACH_WINDOW_MS && p.at<=now);
    if (points.length<2 || !points.some((p,i)=>i>0&&!p.breakBefore&&distanceNm(points[i-1],p)>.02)) continue;
    // Use the inbound leg near Logan, rather than the distant origin or a taxi turn.
    const inbound = points.filter(p=>!p.ground&&distanceNm(p,LOGAN)>=1&&distanceNm(p,LOGAN)<=12);
    if (!inbound.length) continue;
    const entry = inbound.reduce((best,p)=>Math.abs(distanceNm(p,LOGAN)-2.5)<Math.abs(distanceNm(best,LOGAN)-2.5)?p:best);
    const direction = bearing(LOGAN,entry), sector = Math.round(direction/45)%8;
    let group = groups.get(sector);
    if (!group) {group={id:codes[sector],name:directions[sector],bearing:sector*45,tracks:[],lastAt:0};groups.set(sector,group);}
    group.tracks.push({...track,points}); group.lastAt=Math.max(group.lastAt,points.at(-1).at);
  }
  return [...groups.values()].map(g=>({...g,count:g.tracks.length})).sort((a,b)=>b.count-a.count||b.lastAt-a.lastAt||a.bearing-b.bearing);
}

export function chooseApproachView(tracks, now, seen=new Map()) {
  return approachViews(tracks,now).sort((a,b)=>(seen.get(`approach:${a.id}`)??-Infinity)-(seen.get(`approach:${b.id}`)??-Infinity)||b.count-a.count||b.lastAt-a.lastAt)[0] || null;
}

export function approachCamera(view) {
  // A stable oblique shot includes the airport and the first few miles of final.
  // The camera changes only when the direction changes, not on every feed update.
  const target=destination(LOGAN,view.bearing,2400);
  const eye=destination(target,view.bearing+135,10500);
  return {eye:{...eye,altitudeM:5200},target:{...target,altitudeM:150}};
}

export function approachSegments(tracks, now) {
  return tracks.flatMap(track=>track.points.flatMap((b,i)=>{
    const a=track.points[i-1];
    if(!a||b.breakBefore||b.at<=a.at||b.at-a.at>25000||a.at<=now-APPROACH_WINDOW_MS||b.at>now)return [];
    return [{a,b,color:track.color,opacity:.08+.38*Math.max(0,1-(now-b.at)/APPROACH_WINDOW_MS)}];
  }));
}
