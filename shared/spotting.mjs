import { angleDifference, bearing, distanceNm } from './aviation.mjs';
import { classifyFlight } from './flightGuide.mjs';

const helicopters = new Set(['R22','R44','R66','B06','B407','B429','EC35','EC45','H135','H145','S76','A109','AW139','H60']);
export function spottingReason(a) {
  const type=String(a.aircraftType||'');
  if (type==='A388') return {label:'Airbus A380',reason:'Double-deck arrival',priority:6};
  if (/^B74/.test(type)) return {label:'Boeing 747',reason:'Four-engine arrival',priority:6};
  if (helicopters.has(type)) return {label:a.operator,reason:'Helicopter nearby',priority:4};
  const kind=classifyFlight(a);
  if (kind.kind==='private') return {label:a.operator,reason:'Private / charter operator',priority:4};
  if (kind.kind==='cargo') return {label:a.operator,reason:'Cargo arrival',priority:3};
  if (/^(B77|B78|B76|A33|A34|A35)/.test(type)) return {label:a.operator,reason:'Wide-body arrival',priority:2};
  return null;
}
export function sightline(aircraft, home, viewingBearing) {
  const range=distanceNm(home,aircraft), direction=bearing(home,aircraft);
  const delta=angleDifference(direction,viewingBearing);
  const elevation=Math.atan2(aircraft.altitudeFt*.3048-home.altitudeM,Math.max(1,range*1852))*180/Math.PI;
  return {range,bearing:direction,delta,elevation};
}
export function pickSpotting(aircraft, {home,now,selectedId,seen=new Map()}) {
  return aircraft.flatMap(a=>{
    const age=now-a.observedAt, kind=spottingReason(a), line=sightline(a,home,home.bearing);
    if (!kind || a.ground || age<0 || age>15000 || a.id===selectedId || now-(seen.get(`${a.id}:${a.callsign}`)??-Infinity)<1800000) return [];
    if (!Number.isFinite(line.range)||line.range>12||line.range<.2||Math.abs(line.delta)>95||line.elevation< -2||line.elevation>45) return [];
    if (a.phase!=='Likely arrival' && !helicopters.has(a.aircraftType)) return [];
    return [{aircraft:a,...kind,range:line.range}];
  }).sort((a,b)=>b.priority-a.priority || a.range-b.range)[0]||null;
}

export function relativeDirection(delta) {
  if (Math.abs(delta)<8) return 'Straight ahead';
  return `${Math.round(Math.abs(delta))}° ${delta<0?'left':'right'}`;
}
