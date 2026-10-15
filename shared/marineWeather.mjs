export function marineForecast(payload) {
  const p=payload?.properties,period=p?.periods?.[0];
  const updatedAt=Date.parse(p?.updated);
  if (!String(p?.zone||'').endsWith('/ANZ230') || !Number.isFinite(updatedAt) || typeof period?.detailedForecast!=='string' || !period.detailedForecast.trim()) return null;
  return {updatedAt,period:String(period.name||'Forecast'),text:period.detailedForecast.trim().slice(0,2000)};
}
export function harborWaterLevel(payload) {
  if (String(payload?.metadata?.id)!=='8443970') return null;
  const row=payload?.data?.at(-1);
  const at=typeof row?.t==='string'?Date.parse(`${row.t.replace(' ','T')}Z`):NaN;
  const feet=typeof row?.v==='string'&&row.v.trim()?Number(row.v):NaN;
  if (!Number.isFinite(at)||!Number.isFinite(feet)||feet < -20||feet > 30) return null;
  return {at,feet};
}
export function marineAdvisories(payload,now) {
  if (!Array.isArray(payload?.features)) return null;
  const events=payload.features.flatMap(f=>{
    const p=f?.properties;
    if (p?.status!=='Actual'||!Array.isArray(p.affectedZones)||!p.affectedZones.some(z=>String(z).endsWith('/ANZ230'))||Date.parse(p.expires)<=now||!Number.isFinite(Date.parse(p.expires))||typeof p.event!=='string') return [];
    return [{event:p.event,expires:Date.parse(p.expires),severity:p.severity}];
  });
  const rank={Extreme:0,Severe:1,Moderate:2,Minor:3,Unknown:4};
  return events.sort((a,b)=>(rank[a.severity]??4)-(rank[b.severity]??4));
}
export function tidePredictions(payload) {
  if (!Array.isArray(payload?.predictions)) return null;
  const rows=payload.predictions.flatMap(p=>{
    const at=typeof p?.t==='string'?Date.parse(`${p.t.replace(' ','T')}Z`):NaN;
    const feet=typeof p?.v==='string'&&p.v.trim()?Number(p.v):NaN;
    return Number.isFinite(at)&&Number.isFinite(feet)&&feet>=-20&&feet<=30&&['H','L'].includes(p.type)?[{at,feet,type:p.type}]:[];
  }).sort((a,b)=>a.at-b.at);
  return rows.filter((p,i)=>i===0||p.at!==rows[i-1].at);
}
export function tidePhase(predictions,now) {
  if (!Array.isArray(predictions)) return null;
  const index=predictions.findIndex((p,i)=>p.at<=now&&predictions[i+1]?.at>now);
  if (index<0) return null;
  const previous=predictions[index],next=predictions[index+1],duration=next.at-previous.at;
  if (previous.type===next.type||duration<3600000||duration>36000000) return null;
  return {previous,next,afterNext:predictions[index+2]||null,progress:(now-previous.at)/duration,rising:next.type==='H',minutesToNext:Math.ceil((next.at-now)/60000)};
}
