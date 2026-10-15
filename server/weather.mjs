const ENDPOINT = 'https://aviationweather.gov/api/data/metar?ids=KBOS&format=json';
const SOURCE = 'https://aviationweather.gov/data/metar/?id=KBOS';
const MAX_AGE_MS = 90 * 60_000;
const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;

export function normalizeWeather(value, now = Date.now()) {
  if (!value || value.icaoId !== 'KBOS' || !Number.isFinite(value.obsTime)) return null;
  const observedAt = value.obsTime * 1000;
  if (observedAt <= 0 || observedAt > now + 5 * 60_000 || typeof value.rawOb !== 'string' || !value.rawOb.trim()) return null;
  const direction = value.wdir === 'VRB' ? 'VRB' : finite(value.wdir);
  return {
    station: 'KBOS', observedAt, raw: value.rawOb.slice(0, 2000),
    temperatureC: finite(value.temp), dewpointC: finite(value.dewp),
    windDirection: direction === 'VRB' || (direction !== null && direction >= 0 && direction <= 360) ? direction : null,
    windSpeedKts: finite(value.wspd), windGustKts: finite(value.wgst),
    visibilityMiles: typeof value.visib === 'string' || finite(value.visib) !== null ? String(value.visib) : null,
    altimeterHpa: finite(value.altim), verticalVisibilityFt: finite(value.vertVis),
    conditions: typeof value.wxString === 'string' ? value.wxString.slice(0, 100) : null,
    category: ['VFR', 'MVFR', 'IFR', 'LIFR'].includes(value.fltCat) ? value.fltCat : null,
    clouds: Array.isArray(value.clouds) ? value.clouds.filter(c => typeof c.cover === 'string').slice(0, 8).map(c => ({ cover: c.cover, baseFt: finite(c.base) })) : [],
  };
}

// A single station, shared five-minute cache and one in-flight request keep
// airport weather independent of the aircraft feed's five-second cadence.
export function createWeatherService({ fetchImpl = fetch, now = Date.now } = {}) {
  let report = null, pending = null, nextFetchAt = 0, fetchedAt = null, error = null;
  const snapshot = () => ({
    status: !report ? 'unavailable' : error || now() - report.observedAt > MAX_AGE_MS ? 'stale' : 'available',
    report, fetchedAt, serverTime: now(), source: SOURCE,
    error: error || (report && now() - report.observedAt > MAX_AGE_MS ? 'The latest available observation is more than 90 minutes old.' : null),
  });
  return {
    async getSnapshot() {
      if (pending) return pending;
      if (now() < nextFetchAt) return snapshot();
      pending = (async () => {
        try {
          const response = await fetchImpl(ENDPOINT, { signal: AbortSignal.timeout(12_000), headers: { Accept: 'application/json', 'User-Agent': 'BOS42-personal-viewer/0.1' } });
          if (!response.ok || response.status === 204) throw new Error('Weather report unavailable');
          const values = await response.json();
          const latest = Array.isArray(values) ? values.map(value => normalizeWeather(value, now())).filter(Boolean).sort((a, b) => b.observedAt - a.observedAt)[0] : null;
          if (!latest) throw new Error('No valid Logan observation');
          // An upstream cache regression must not replace a newer observation.
          if (!report || latest.observedAt >= report.observedAt) report = latest;
          fetchedAt = now(); error = null; nextFetchAt = now() + 5 * 60_000;
        } catch {
          error = report ? 'Weather updates interrupted. Showing the last received observation.' : 'Logan’s weather report is temporarily unavailable.';
          nextFetchAt = now() + 60_000;
        }
        return snapshot();
      })();
      try { return await pending; } finally { pending = null; }
    },
  };
}
