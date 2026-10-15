import { useEffect, useState, useRef, useCallback } from 'react';
import type { Feed, RouteResult } from './types';
import { demoFeed } from './demo';
import { apiUrl } from './api';

const initial: Feed = { aircraft: [], status: 'connecting', fetchedAt: null, sourceTime: null, serverTime: Date.now(), provider: null, providerName: null, attribution: null, ageSeconds: null, error: null, retryAfterMs: 5000, radiusNm: 40 };
export function useAircraft(demo: boolean) {
  const [feed, setFeed] = useState<Feed>(initial);
  const [tick, setTick] = useState(Date.now());
  const [revision, setRevision] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const clockOffsetRef = useRef(0);
  const retry = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => {
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    setFeed(previous => demo ? initial : previous.status === 'demo' ? initial : previous);
    async function poll() {
      if (cancelled) return;
      if (demo) { setFeed(demoFeed()); timer = setTimeout(poll, 1000); return; }
      if (document.hidden) { timer = setTimeout(poll, 3000); return; }
      const controller = new AbortController(); abortRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), 24000);
      let delay = 5000;
      try {
        const response = await fetch(apiUrl('/api/aircraft'), { signal: controller.signal, cache: 'no-store' });
        const value = await response.json() as Feed;
        if (!Array.isArray(value.aircraft) || !['live', 'stale', 'unavailable'].includes(value.status)) throw new Error('Invalid live feed response');
        clockOffsetRef.current = value.serverTime - Date.now();
        if (!cancelled) setFeed(value);
        if (value.status !== 'live') delay = Math.max(5000, Math.min(60000, value.retryAfterMs || 10000));
      } catch (error) {
        if (!cancelled) setFeed(previous => ({ ...previous, status: previous.aircraft.length ? 'stale' : 'unavailable', error: error instanceof Error && error.name === 'AbortError' ? 'The live feed is taking too long to respond.' : 'Cannot reach the live feed. Check your connection.' }));
        delay = 10000;
      } finally { clearTimeout(timeout); if (abortRef.current === controller) abortRef.current = null; if (!cancelled) timer = setTimeout(poll, delay); }
    }
    const visibility = () => { if (!document.hidden && !abortRef.current) { clearTimeout(timer); void poll(); } };
    document.addEventListener('visibilitychange', visibility);
    void poll();
    return () => { cancelled = true; clearTimeout(timer); abortRef.current?.abort(); document.removeEventListener('visibilitychange', visibility); };
  }, [demo, revision, retry]);
  useEffect(() => { const timer = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const now = tick + (demo ? 0 : clockOffsetRef.current);
  const age = feed.sourceTime === null ? null : Math.max(0, (now - feed.sourceTime) / 1000);
  const status = feed.status === 'live' && age !== null && age > 20 ? 'stale' : feed.status;
  return { feed: { ...feed, status, ageSeconds: age }, now, clockOffset: clockOffsetRef.current, retry };
}

const routeCache = new Map<string, { result: RouteResult; expires: number }>();
export function useRoute(callsign: string | undefined, demo: boolean) {
  const [lookup, setLookup] = useState<{callsign: string | undefined; result: RouteResult}>({ callsign, result: { route: null, status: 'loading', source: 'adsbdb' } });
  useEffect(() => {
    const setResult = (result: RouteResult) => setLookup({callsign, result});
    if (!callsign || demo) { setResult({ route: null, status: demo ? 'demo' : 'unknown', source: 'adsbdb' }); return; }
    const hit = routeCache.get(callsign); if (hit && hit.expires > Date.now()) { setResult(hit.result); return; }
    const controller = new AbortController();
    setResult({ route: null, status: 'loading', source: 'adsbdb' });
    Promise.resolve().then(() => fetch(apiUrl(`/api/route/${encodeURIComponent(callsign)}`), { signal: controller.signal, cache: 'no-store' }))
      .then(r => r.json()).then((value: RouteResult) => { if (controller.signal.aborted) return; if (value.status === 'found' || value.status === 'unknown') routeCache.set(callsign, {result: value, expires: Date.now() + 3600000}); setResult(value); })
      .catch(() => { if (!controller.signal.aborted) setResult({ route: null, status: 'unavailable', source: 'adsbdb' }); });
    return () => controller.abort();
  }, [callsign, demo]);
  return lookup.callsign === callsign ? lookup.result : {route: null, status: 'loading', source: 'adsbdb'};
}
