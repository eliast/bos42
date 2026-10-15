const ENDPOINT = 'https://www.fly.faa.gov/fly/flyfaa/flyfaaindex?ARPT=BOS&p=1';
const MAX_AGE_MS = 30 * 60_000;

function plain(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

export function parseBosStatus(html, now = Date.now()) {
  if (typeof html !== 'string' || !/Logan International Airport \(BOS\) Real-time Status/i.test(html)) return null;
  const field = label => {
    const match = html.match(new RegExp(`${label}:[\\s\\S]*?<\\/b>([\\s\\S]*?)<\\/td>`, 'i'));
    return match ? plain(match[1]).slice(0, 400) : null;
  };
  const stamp = html.match(/This information was last updated:\s*<b>([^<]+)<\/b>/i);
  const updatedAt = stamp ? Date.parse(plain(stamp[1]).replace(' at ', ' ')) : NaN;
  const departures = field('General Departure Delays');
  const arrivals = field('General Arrival Delays');
  const destinations = field('Delays by Destination');
  if (!Number.isFinite(updatedAt) || updatedAt > now + 5 * 60_000 || updatedAt <= 0 || !departures || !arrivals || !destinations) return null;
  return { airport: 'BOS', updatedAt, departures, arrivals, destinations };
}

export function createFaaStatusService({ fetchImpl = fetch, now = Date.now } = {}) {
  let report = null, pending = null, nextFetchAt = 0, fetchedAt = null, error = null;
  const snapshot = () => ({
    status: !report ? 'unavailable' : error || now() - report.updatedAt > MAX_AGE_MS ? 'stale' : 'available',
    report, fetchedAt, serverTime: now(), source: ENDPOINT,
    error: error || (report && now() - report.updatedAt > MAX_AGE_MS ? 'The FAA report is more than 30 minutes old.' : null),
  });
  return {
    async getSnapshot() {
      if (pending) return pending;
      if (now() < nextFetchAt) return snapshot();
      pending = (async () => {
        try {
          const response = await fetchImpl(ENDPOINT, { signal: AbortSignal.timeout(12_000), headers: { Accept: 'text/html', 'User-Agent': 'BOS42-personal-viewer/0.1' } });
          if (!response.ok) throw new Error('FAA status unavailable');
          const latest = parseBosStatus(await response.text(), now());
          if (!latest) throw new Error('Invalid FAA BOS report');
          if (!report || latest.updatedAt >= report.updatedAt) report = latest;
          fetchedAt = now(); error = null; nextFetchAt = now() + 5 * 60_000;
        } catch {
          error = report ? 'FAA updates interrupted. Showing the last report.' : 'FAA BOS status is temporarily unavailable.';
          nextFetchAt = now() + 60_000;
        }
        return snapshot();
      })();
      try { return await pending; } finally { pending = null; }
    },
  };
}
