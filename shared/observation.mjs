import { bearing, angleDifference } from './aviation.mjs';
import { spottingReason } from './spotting.mjs';
import {chooseApproachView} from './approaches.mjs';

const LOGAN = {lat:42.3656,lon:-71.0096};
const fresh = (a, now) => !a.ground && now >= a.observedAt && now - a.observedAt < 20000;

// This is a straight-line closing-time estimate, not a runway or schedule ETA.
export function arrivalQueue(aircraft, now) {
  return aircraft.filter(a => fresh(a, now) && a.phase === 'Likely arrival' && Number.isFinite(a.distanceNm) && a.distanceNm > 0 && a.distanceNm < 30)
    .map(aircraft => {
      const closing = aircraft.headingKnown !== false && aircraft.speedKnown !== false && Number.isFinite(aircraft.heading) && Number.isFinite(aircraft.speedKts)
        ? aircraft.speedKts * Math.cos(angleDifference(aircraft.heading, bearing(aircraft, LOGAN)) * Math.PI / 180) : 0;
      const seconds = closing > 40 ? Math.max(0, aircraft.distanceNm / closing * 3600 - (now - aircraft.observedAt) / 1000) : null;
      return {aircraft, seconds};
    }).sort((a,b) => (a.seconds ?? Infinity) - (b.seconds ?? Infinity) || a.aircraft.distanceNm - b.aircraft.distanceNm);
}

export function aircraftSpotlights(aircraft, now) {
  return aircraft.filter(a => fresh(a, now) && Number.isFinite(a.distanceNm) && a.distanceNm < 40).flatMap(aircraft => {
    const reason = spottingReason(aircraft);
    if (!reason) return [];
    // Labels describe a type or operator, not measured statistical rarity.
    const description = aircraft.aircraftType === 'A388' ? 'Double-deck A380' : /^B74/.test(aircraft.aircraftType || '') ? 'Four-engine 747' : reason.reason.replace('arrival', 'aircraft');
    return [{aircraft, description, priority:reason.priority}];
  }).sort((a,b) => b.priority-a.priority || a.aircraft.distanceNm-b.aircraft.distanceNm);
}

export function directorScene(aircraft, vessels, now, step, seen = new Map(), history = []) {
  const slots = ['aircraft','Runways','vessel','Harbor','aircraft','Skyline','Apartment','Traffic'];
  const slot = slots[step % slots.length];
  if(slot==='Traffic')return {kind:'traffic',filter:Math.floor(step/slots.length)%2&&vessels.length?'harbor':'arrivals',label:'Traffic board'};
  if (slot === 'aircraft') {
    const candidates = [...aircraftSpotlights(aircraft, now).map(x=>x.aircraft), ...arrivalQueue(aircraft, now).map(x=>x.aircraft), ...aircraft.filter(a=>fresh(a,now)&&a.distanceNm<20)];
    const candidate = candidates.find(a=>now-(seen.get(`aircraft:${a.id}`) ?? -Infinity)>180000);
    if (candidate) return {kind:'aircraft', id:candidate.id, label:candidate.label};
  }
  if (slot === 'vessel') {
    const candidate = vessels.filter(v=>!v.stale && now>=v.observedAt && now-v.observedAt<20000 && v.speedKts>1 && now-(seen.get(`vessel:${v.id}`)??-Infinity)>180000)
      .sort((a,b)=>(b.lengthM||0)-(a.lengthM||0))[0];
    if (candidate) return {kind:'vessel',id:candidate.id,label:candidate.name||candidate.label||'Harbor vessel'};
  }
  const view = slot === 'aircraft' ? (step % slots.length === 0 ? 'Harbor' : 'Runways') : slot === 'vessel' ? 'Skyline' : slot;
  if(view==='Runways'){
    const approach=chooseApproachView(history,now,seen);
    if(approach)return {kind:'scenic',view,approach,label:`Approaches from the ${approach.name.toLowerCase()}`};
  }
  return {kind:'scenic',view,label:view === 'Apartment' ? 'Your window · Floor 42' : view};
}
