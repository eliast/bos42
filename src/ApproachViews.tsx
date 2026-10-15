import type {ApproachView} from '../shared/approaches.mjs';
import './approaches.css';
import {MAX_GHOST_TRACKS} from './ApproachTrails';

export function ApproachViews({views,activeId,source,onSelect}:{views:ApproachView[];activeId:string|null;source:'server'|'session'|'demo';onSelect:(view:ApproachView)=>void}){
  const active=views.find(v=>v.id===activeId);
  return <section className="approach-view-panel" aria-label="Arrival history views">
    <small>{source==='demo'?'SIMULATED APPROACHES':'RECENT APPROACHES'} · 15 MIN</small>
    <strong>{active?`From the ${active.name.toLowerCase()}`:views.length?'Choose an arrival direction':'Collecting arrival paths'}</strong>
    <div className="approach-direction-buttons" role="group" aria-label="View approaches from different directions">
      {[...views].sort((a,b)=>a.bearing-b.bearing).map(view=><button key={view.id} aria-label={`View approaches from the ${view.name.toLowerCase()}, ${view.count} recorded tracks`} aria-pressed={activeId===view.id} onClick={()=>onSelect(view)}>{view.id}<span>{view.count}</span></button>)}
    </div>
    <p>{active?`${active.count>MAX_GHOST_TRACKS?'Latest 6 of ':''}${active.count} recorded ${active.count===1?'path':'paths'} · older paths fade`:'Views appear as arrival paths are recorded.'}{source==='session'?' · this session':''}</p>
    <em>Directions inferred from tracks</em>
  </section>;
}
