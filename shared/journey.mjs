const HOUR = 3600000;
const clean = value => typeof value === 'string' ? value.trim().toUpperCase() : '';
const stamp = value => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const airport = a => a ? { code: a.code_iata || a.code_icao || a.code || null, icao: a.code_icao || a.code || null, city: a.city || a.name || null, timezone: a.timezone || 'UTC' } : null;
const zone = value => { try { new Intl.DateTimeFormat('en', {timeZone:value}).format(); return value; } catch { return 'UTC'; } };
const day = (time, timezone) => new Intl.DateTimeFormat('en-CA', {timeZone:zone(timezone), year:'numeric',month:'2-digit',day:'2-digit'}).format(time);

/** Match the actual leg, not tomorrow's reuse of the same flight number. */
export function normalizeJourney(body, aircraft, now) {
  const rows = Array.isArray(body?.flights) ? body.flights : [];
  const identity = rows.filter(f => [f.ident, f.ident_icao, f.ident_iata, f.atc_ident].some(v => clean(v) && clean(v) === clean(aircraft.callsign)));
  const candidates = identity.filter(f => {
    if (f.cancelled || f.diverted) return false;
    if (aircraft.registration && f.registration && clean(f.registration) !== clean(aircraft.registration)) return false;
    const off = stamp(f.actual_off), out = stamp(f.actual_out), on = stamp(f.actual_on), inside = stamp(f.actual_in);
    const began = off ?? out;
    if (began === null || began > now || began < now - 26 * HOUR) return false;
    if (!aircraft.ground && (off === null || on !== null && on <= now || inside !== null && inside <= now)) return false;
    if (aircraft.ground && (on ?? inside) !== null && now - (on ?? inside) > 30 * 60000) return false;
    return true;
  });
  // Multiple active candidates are ambiguous; avoid showing another leg's times.
  const unique = [...new Map(candidates.map(f => [f.fa_flight_id || `${f.ident}:${f.actual_off || f.actual_out}`, f])).values()];
  if (unique.length !== 1) return null;
  const f = unique[0];
  const times = {};
  for (const field of ['scheduled_out','estimated_out','actual_out','scheduled_off','estimated_off','actual_off','scheduled_on','estimated_on','actual_on','scheduled_in','estimated_in','actual_in']) {
    const value = stamp(f[field]);
    times[field] = field.startsWith('actual_') && value > now ? null : value;
  }
  const departureReference = times.actual_out !== null ? 'gate' : times.actual_off !== null ? 'runway' : null;
  const arrivalReference = times.scheduled_in !== null && (times.actual_in ?? times.estimated_in) !== null ? 'gate' : times.scheduled_on !== null && (times.actual_on ?? times.estimated_on) !== null ? 'runway' : null;
  const delay = (planned, value) => planned !== null && value !== null ? Math.round((value - planned) / 60000) : null;
  const origin = airport(f.origin), destination = airport(f.destination);
  const timezone = origin?.timezone || 'UTC';
  const today = day(now, timezone);
  // Derive seven complete local calendar dates at noon UTC (safe for US/European origins).
  // Collect dates by stepping 12 hours, which also handles DST and extreme UTC offsets.
  const previousDays = [...new Set(Array.from({length:20}, (_, i) => day(now - (i + 1) * 12 * HOUR, timezone)))].filter(d => d < today).sort().slice(-7);
  const operated = new Set(identity.filter(r => !r.cancelled && !r.diverted && airport(r.origin)?.icao === origin?.icao && airport(r.destination)?.icao === destination?.icao)
    .map(r => stamp(r.actual_off)).filter(t => t !== null && t < now).map(t => day(t, timezone)));
  return {
    flightId:f.fa_flight_id || null, callsign:f.ident_icao || f.ident, origin, destination, times,
    departureDelayMinutes: departureReference === 'gate' ? delay(times.scheduled_out,times.actual_out) : delay(times.scheduled_off,times.actual_off), departureReference,
    arrivalDelayMinutes: arrivalReference === 'gate' ? delay(times.scheduled_in,times.actual_in ?? times.estimated_in) : delay(times.scheduled_on,times.actual_on ?? times.estimated_on), arrivalReference,
    arrivalIsEstimate: arrivalReference === 'gate' ? times.actual_in === null : times.actual_on === null,
    frequency: {days:previousDays.map(date => ({date, operated:operated.has(date)})), count:previousDays.filter(d => operated.has(d)).length, partial:!!body.links?.next, timezone, basis:'Recorded departures on this route; not a future timetable'},
  };
}

export function delayText(minutes, estimated = false) {
  if (!Number.isFinite(minutes)) return null;
  const text = minutes === 0 ? 'On time' : minutes > 0 ? `${minutes} min late` : `${Math.abs(minutes)} min early`;
  return estimated ? `Expected ${text.toLowerCase()}` : text;
}
