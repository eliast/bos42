// Keep the current arrival through short level-offs and its first ground report.
// A disappearing track or go-around releases it immediately.
export function watchFlight(aircraft, now) {
  return {id: aircraft.id, arrival: aircraft.phase === 'Likely arrival', groundSince: aircraft.ground ? now : null, pinned: true};
}

export function nextLikelyArrival(aircraft, now) {
  return aircraft.filter(a => !a.ground && a.phase === 'Likely arrival' && Number.isFinite(a.distanceNm) && a.distanceNm < 15 && now - a.observedAt >= 0 && now - a.observedAt < 20000)
    .sort((a, b) => a.distanceNm - b.distanceNm)[0] || null;
}

export function automaticSelection(aircraft, previous, now) {
  const fresh = aircraft.filter(a => now - a.observedAt < 20000);
  const current = fresh.find(a => a.id === previous?.id);
  // An explicit tap chooses the flight to watch, not manual mode. Keep it even
  // when another arrival is nearer; after touchdown Auto takes over again.
  if (current && previous?.pinned) {
    const groundSince = current.ground ? previous.groundSince ?? now : null;
    if (!current.ground || now - groundSince < 12000) return {...previous, groundSince, arrival: previous.arrival || current.phase === 'Likely arrival'};
  }
  if (current && previous?.arrival) {
    const stillApproaching = !current.ground && current.distanceNm < 3 && current.altitudeFt < 1500 && current.verticalRateFpm < 350;
    const groundSince = current.ground ? previous.groundSince ?? now : null;
    if (stillApproaching || current.ground && now - groundSince < 12000) return {...previous, groundSince};
  }
  const next = nextLikelyArrival(fresh, now);
  if (next) return {id: next.id, arrival: true, groundSince: null};
  const nearest = fresh.filter(a => !a.ground && a.distanceNm < 20).sort((a,b) => a.distanceNm - b.distanceNm)[0];
  return nearest ? {id: nearest.id, arrival: false, groundSince: null} : {id: null, arrival: false, groundSince: null};
}
