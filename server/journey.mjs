import { normalizeJourney } from '../shared/journey.mjs';

// Official schema: https://www.flightaware.com/commercial/aeroapi/resources/aeroapi-openapi.yml
// One bounded page supplies this leg plus recent departures; never follow next links.
export function createJourneyService({key=process.env.AEROAPI_KEY, dailyLimit=Number(process.env.AEROAPI_DAILY_REQUEST_LIMIT ?? 20), fetchImpl=fetch, now=Date.now}={}) {
  const cache = new Map(), pending = new Map();
  let day = '', used = 0, cooldown = 0;
  const result = (status, extra={}) => ({status, journey:null, source:'FlightAware AeroAPI', retrievedAt:null, ...extra});
  async function request(callsign) {
    if (!key) return result('unconfigured');
    const today = new Date(now()).toISOString().slice(0,10);
    if (day !== today) {day=today;used=0;}
    if (now()<cooldown) return result('unavailable');
    if (!Number.isFinite(dailyLimit) || used>=Math.max(0,Math.min(1000,dailyLimit))) return result('budget_limit');
    used++;
    const url=new URL(`https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(callsign)}`);
    url.searchParams.set('ident_type','designator');url.searchParams.set('max_pages','1');
    url.searchParams.set('start',new Date(now()-8*86400000).toISOString());
    url.searchParams.set('end',new Date(now()+86400000).toISOString());
    try {
      const response=await fetchImpl(url,{headers:{'x-apikey':key,Accept:'application/json'},signal:AbortSignal.timeout(9000)});
      if (!response.ok) {cooldown=now()+ (response.status===429 ? 3600000 : 600000);return result(response.status===401||response.status===403?'access_required':'unavailable');}
      const body=await response.json();
      if (!Array.isArray(body.flights)) throw new Error('Invalid flight response');
      return {status:'ready',body,retrievedAt:now()};
    } catch {cooldown=now()+60000;return result('unavailable');}
  }
  return {async get(aircraft) {
    const callsign=aircraft?.callsign;
    if (!/^[A-Z0-9]{2,10}$/.test(callsign||'')) return result('unknown');
    if (!key) return result('unconfigured');
    let hit=cache.get(callsign);
    if (!hit || now()-hit.cachedAt>600000) {
      if (!pending.has(callsign)) {
        if (pending.size>=2) return result('busy');
        pending.set(callsign,request(callsign).then(value=>{const entry={value,cachedAt:now()};cache.set(callsign,entry);if(cache.size>200)cache.delete(cache.keys().next().value);return entry;}).finally(()=>pending.delete(callsign)));
      }
      hit=await pending.get(callsign);
    }
    if (hit.value.status!=='ready') return hit.value;
    const journey=normalizeJourney(hit.value.body,aircraft,now());
    return result(journey?'found':'unknown',{journey,retrievedAt:hit.value.retrievedAt});
  }};
}
