import { normalizeFeed } from '../shared/aviation.mjs';
import { meanSeaLevel } from 'egm96-universal';
import {createApproachHistory} from '../shared/approaches.mjs';

const PROVIDERS = [
  { id: 'adsb.lol', name: 'ADSB.lol', url: 'https://api.adsb.lol/v2/point/42.3656/-71.0096/40', attribution: 'https://www.adsb.lol', license: 'ODbL 1.0' },
  { id: 'adsb.fi', name: 'adsb.fi', url: 'https://opendata.adsb.fi/api/v3/lat/42.3656/lon/-71.0096/dist/40', attribution: 'https://adsb.fi', license: 'Personal, non-commercial use' },
];
export function createFeedService({ fetchImpl = fetch, now = Date.now, providers = PROVIDERS, timeoutMs = 10000 } = {}) {
  let snapshot = null, pending = null, nextAttempt = 0, failureCount = 0, lastError = null;
  let preferredProvider = null, preferUntil = 0;
  const history = createApproachHistory({now});
  let historyTimer = null;
  const observers=new Set();
  async function refresh() {
    const failures = [];
    const ordered = preferredProvider && now() < preferUntil
      ? [preferredProvider, ...providers.filter(p => p.id !== preferredProvider.id)] : providers;
    for (const provider of ordered) {
      try {
        const response = await fetchImpl(provider.url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json', 'User-Agent': 'BOS42-personal-prototype/0.1' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        const normalized = normalizeFeed(body, now(), meanSeaLevel);
        if (now() - normalized.sourceTime > 20000) throw new Error('feed timestamp is stale');
        const previous = new Map((snapshot?.aircraft || []).map(a => [a.id, a]));
        normalized.aircraft = normalized.aircraft.map(a => {
          const old = previous.get(a.id);
          if (a.callsign || !old?.callsign || !old.identityObservedAt || now() - old.identityObservedAt > 600000) return a;
          return {...a, callsign: old.callsign, label: old.label, operator: old.operator, color: old.color, identityObservedAt: old.identityObservedAt};
        });
        snapshot = { ...normalized, provider: provider.id, providerName: provider.name, attribution: provider.attribution, license: provider.license };
        history.ingest(normalized.aircraft,now());
        for(const observe of observers)try{observe(normalized.aircraft,now());}catch{/* A history consumer must not interrupt live positions. */}
        // Keep a working backup for a minute before probing the primary again.
        // Several viewers still share one request and the same freshness clock.
        if (provider.id !== providers[0]?.id && (preferredProvider?.id !== provider.id || now() >= preferUntil)) preferUntil = now() + 60000;
        preferredProvider = provider;
        failureCount = 0; lastError = null; nextAttempt = now() + 4500;
        return;
      } catch (error) { failures.push(`${provider.name}: ${error.name === 'TimeoutError' ? 'request timed out' : error.message}`); }
    }
    lastError = failures.join('; '); failureCount += 1;
    nextAttempt = now() + Math.min(60000, 5000 * 2 ** (failureCount - 1));
  }
  return {
    subscribe(observe){observers.add(observe);return()=>observers.delete(observe);},
    getApproachHistory() { return history.snapshot(); },
    start() {
      if (historyTimer) return;
      const tick = () => { void this.getSnapshot().catch(()=>{}); };
      tick(); historyTimer=setInterval(tick,5000); historyTimer.unref?.();
    },
    stop() { clearInterval(historyTimer); historyTimer=null; },
    async getSnapshot() {
      if (now() >= nextAttempt && !pending) pending = refresh().finally(() => { pending = null; });
      if (pending) await pending;
      const current = now();
      const ageSeconds = snapshot ? Math.max(0, (current - snapshot.sourceTime) / 1000) : null;
      return {
        ...(snapshot || { aircraft: [], sourceTime: null, fetchedAt: null, provider: null, providerName: null, attribution: null, license: null }),
        status: !snapshot ? 'unavailable' : lastError || ageSeconds > 20 ? 'stale' : 'live',
        ageSeconds, serverTime: current, error: lastError,
        retryAfterMs: Math.max(1000, nextAttempt - current), radiusNm: 40,
      };
    },
  };
}

export function createRouteService({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map();
  let inFlight = 0;
  async function request(callsign) {
    if (inFlight >= 3) return { route: null, status: 'busy', source: 'adsbdb' };
    inFlight += 1;
    try {
      const response = await fetchImpl(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`, { signal: AbortSignal.timeout(7000), headers: { Accept: 'application/json' } });
      if (response.status === 404) { const value = { route: null, status: 'unknown', source: 'adsbdb' }; cache.set(callsign, { value, expires: now() + 3600000 }); return value; }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json(), r = body.response?.flightroute;
      const airport = a => a ? { name: a.name, municipality: a.municipality, iata: a.iata_code || null, icao: a.icao_code || null, country: a.country_name, lat: a.latitude, lon: a.longitude } : null;
      const route = r ? { callsign: r.callsign, flightNumber: r.callsign_iata, airline: r.airline?.name || null, origin: airport(r.origin), destination: airport(r.destination), via: airport(r.midpoint), retrievedAt: now() } : null;
      const value = { route, status: route ? 'found' : 'unknown', source: 'adsbdb' };
      if (cache.size > 1000) cache.delete(cache.keys().next().value);
      cache.set(callsign, { value, expires: now() + 6 * 3600000 }); return value;
    } catch { return { route: null, status: 'unavailable', source: 'adsbdb' }; }
    finally { inFlight -= 1; }
  }
  return {
    async get(callsign) {
      if (!/^[A-Z0-9]{2,10}$/.test(callsign)) return { route: null, status: 'invalid', source: 'adsbdb' };
      const hit = cache.get(callsign); if (hit && hit.expires > now()) return hit.value;
      if (!pending.has(callsign)) pending.set(callsign, request(callsign).finally(() => pending.delete(callsign)));
      return pending.get(callsign);
    },
  };
}
