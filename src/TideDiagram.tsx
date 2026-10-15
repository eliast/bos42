import {tidePhase,type TidePrediction} from '../shared/marineWeather.mjs';
const label=(p:TidePrediction)=>`${p.type==='H'?'High':'Low'} ${new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(p.at)}`;
export function TideDiagram({predictions,now,cached}:{predictions:TidePrediction[]|null;now:number;cached:boolean}) {
  const phase=tidePhase(predictions,now);
  if(!phase)return <p className="tide-unavailable">Tide cycle unavailable</p>;
  const points=[phase.previous,phase.next,...phase.afterNext?[phase.afterNext]:[]];
  const low=Math.min(...points.map(p=>p.feet)),high=Math.max(...points.map(p=>p.feet));
  const y=(feet:number)=>56-(feet-low)/Math.max(.1,high-low)*34;
  const x=(i:number)=>10+i/(points.length-1)*250;
  const height=(i:number,t:number)=>points[i].feet+(points[i+1].feet-points[i].feet)*(1-Math.cos(Math.PI*t))/2;
  const path=points.slice(0,-1).flatMap((_,i)=>Array.from({length:25},(_,n)=>`${i===0&&n===0?'M':'L'}${(x(i)+(x(i+1)-x(i))*n/24).toFixed(2)},${y(height(i,n/24)).toFixed(2)}`)).join(' ');
  const dotX=x(0)+(x(1)-x(0))*phase.progress,dotY=y(height(0,phase.progress));
  const h=Math.floor(phase.minutesToNext/60),m=phase.minutesToNext%60;
  const remaining=`${h?`${h}h `:''}${m}m`;
  return <div className="tide-diagram" aria-label={`Predicted tide ${phase.rising?'rising':'falling'}, ${remaining} until ${phase.next.type==='H'?'high':'low'} tide`}>
    <div className="tide-phase"><b>{phase.rising?'↗ Rising':'↘ Falling'}</b><span>{remaining} to {phase.next.type==='H'?'high':'low'}</span></div>
    <svg viewBox="0 0 270 76" role="img" aria-label="Predicted tide curve with current time marked">
      <path d={`${path} L260,70 L10,70 Z`} fill="#73bac812"/>
      <path d="M10 70H260" stroke="#8caab52e"/>
      <path d={path} fill="none" stroke="#91cbd1" strokeWidth="2"/>
      {points.map((p,i)=><circle key={p.at} cx={x(i)} cy={y(p.feet)} r="2.5" fill="#91cbd1"/>)}
      <path d={`M${dotX},${dotY+7}V70`} stroke="#efcb87" strokeDasharray="2 3"/>
      <circle cx={dotX} cy={dotY} r="7" fill="#efcb8724"/><circle cx={dotX} cy={dotY} r="3.5" fill="#efcb87"/>
      <text x={Math.max(20,Math.min(250,dotX))} y={Math.max(12,dotY-11)} textAnchor="middle" fill="#efcb87" fontSize="9">NOW</text>
    </svg>
    <div className="tide-event-times">{points.map(p=><span key={p.at}>{label(p)}</span>)}</div>
    <small className="tide-prediction-note">NOAA predicted cycle{cached?' · saved prediction':''}</small>
  </div>;
}
