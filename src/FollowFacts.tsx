import {aircraftModelFacts,resolveAircraftProfile} from '../shared/aircraftProfiles.mjs';
import type {Aircraft} from './types';
import './followFacts.css';
import {FlightStory} from './FlightStory';
export function FollowFacts({aircraft,onInfo}:{aircraft:Aircraft;onInfo:()=>void}) {
  const profile=resolveAircraftProfile(aircraft.aircraftType);
  const facts=aircraftModelFacts(aircraft.aircraftType).filter(f=>!['About this model','Seating / occupancy'].includes(f.label));
  if (!profile || !facts.length) return null;
  return <section className="follow-stats-card" role="button" tabIndex={0} aria-label={`Open aircraft info for ${aircraft.registration || aircraft.label}`} onClick={onInfo} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onInfo();}}}>
    <header><div><small>FOLLOWING · {aircraft.registration || aircraft.label}</small><h2>{profile?.name || aircraft.aircraftType || 'Aircraft model not reported'}</h2></div><span>{aircraft.label}</span></header>
    <FlightStory aircraft={aircraft}/>
    <dl>{facts.map(f=><div key={f.label} className={f.label==='Engine options'||f.label==='Published fuel reference'?'wide-stat':''}><dt>{f.label}</dt><dd>{f.text}</dd></div>)}</dl>
    <footer><span>{profile?.fallback?'Reference variant · fitted configuration unconfirmed':'Published model specifications'}</span></footer>
  </section>;
}
