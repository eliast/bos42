import { setTimeout as wait } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';

// Exercise the running server without storing flight identities or coordinates.
const duration = Math.max(0, Number(process.argv[2] || 300));
if (!Number.isFinite(duration) || duration > 3600) throw new Error('Use a duration from 0 to 3600 seconds.');
const base = process.env.BOS42_URL || 'http://localhost:4242';
const startedAt = Date.now(), samples = [];
do {
  const began = Date.now();
  try {
    const response = await fetch(`${base}/api/aircraft`, { signal: AbortSignal.timeout(25000) });
    const data = await response.json();
    const problems = [];
    if (!['live', 'stale', 'unavailable'].includes(data.status)) problems.push('invalid status');
    if (!Array.isArray(data.aircraft)) problems.push('missing aircraft array');
    if (data.status === 'live' && (data.ageSeconds > 20 || !Number.isFinite(data.sourceTime))) problems.push('old or missing timestamp labelled live');
    for (const a of data.aircraft || []) {
      if (![a.lat, a.lon, a.altitudeFt, a.speedKts, a.heading, a.observedAt].every(Number.isFinite)) problems.push('non-finite aircraft value');
      if (a.observedAt > data.serverTime + 1000) problems.push('future position');
      if (!/^#[0-9a-f]{6}$/i.test(a.color)) problems.push('invalid aircraft color');
    }
    samples.push({at:new Date().toISOString(), status:data.status, http:response.status, provider:data.provider, ageSeconds:data.ageSeconds, aircraft:data.aircraft?.length || 0, freshPositions:data.aircraft?.filter(a=>data.serverTime-a.observedAt<20000).length || 0, durationMs:Date.now()-began, problems:[...new Set(problems)]});
  } catch (error) {
    samples.push({at:new Date().toISOString(), status:'request_failed', durationMs:Date.now()-began, problems:[error.message]});
  }
  console.log(JSON.stringify(samples.at(-1)));
  const remaining = startedAt + duration * 1000 - Date.now();
  if (remaining <= 0) break;
  await wait(Math.min(15000, remaining));
} while (Date.now() - startedAt <= duration * 1000);

const summary = {
  startedAt:new Date(startedAt).toISOString(), finishedAt:new Date().toISOString(), samples:samples.length,
  statuses:Object.fromEntries([...new Set(samples.map(s=>s.status))].map(status=>[status,samples.filter(s=>s.status===status).length])),
  providers:[...new Set(samples.map(s=>s.provider).filter(Boolean))],
  problems:samples.filter(s=>s.problems.length),
};
await mkdir(new URL('../artifacts/', import.meta.url), {recursive:true});
const report = new URL(`../artifacts/live-check-${startedAt}.json`, import.meta.url);
await writeFile(report, JSON.stringify({summary, samples}, null, 2));
console.log(JSON.stringify({summary, report:report.pathname}));
if (summary.problems.length) process.exitCode = 1;
