import test from 'node:test';
import assert from 'node:assert/strict';
import { apiBase } from '../shared/apiUrl.mjs';
import { createApp } from '../server/app.mjs';

test('native builds require a hosted HTTPS API; browser development keeps same-origin requests', () => {
  assert.equal(apiBase(''), '');
  assert.equal(apiBase('https://bos42.example/ ', true), 'https://bos42.example');
  for (const value of ['', 'http://bos42.example', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://user:secret@bos42.example', 'https://bos42.example/api', 'https://bos42.example?key=secret']) {
    assert.throws(() => apiBase(value, true));
  }
});

test('native API supports Capacitor origin, rejects other origins and preserves feed failure status', async t => {
  let requests = 0;
  const app = createApp({
    feed: { getSnapshot: async () => { requests++; return { status: 'unavailable', aircraft: [] }; }, getApproachHistory:()=>({tracks:[],serverTime:1,windowMs:900000}) },
    routes: { get: async callsign => ({ callsign, status: 'unknown', route: null }) },
    harbor: { getSnapshot: () => ({ status: 'live', vessels: [{ id: '367784560', name: 'CHAMPION' }] }) },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${base}/api/health`, { headers: { Origin: 'capacitor://localhost' } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('access-control-allow-origin'), 'capacitor://localhost');
  assert.equal((await health.json()).ok, true);
  assert.equal(requests, 0, 'health does not depend on a public flight provider');
  const history=await fetch(`${base}/api/approaches`,{headers:{Origin:'capacitor://localhost'}});
  assert.equal(history.status,200);assert.equal(history.headers.get('access-control-allow-origin'),'capacitor://localhost');
  assert.equal((await history.json()).status,'collecting');assert.equal(requests,0,'history reads do not cause extra upstream polling');
  const preflight = await fetch(`${base}/api/aircraft`, { method: 'OPTIONS', headers: { Origin: 'capacitor://localhost', 'Access-Control-Request-Method': 'GET' } });
  assert.equal(preflight.status, 204);
  const denied = await fetch(`${base}/api/aircraft`, { headers: { Origin: 'https://unrelated.example' } });
  assert.equal(denied.status, 403);
  assert.equal(requests, 0);
  const unavailable = await fetch(`${base}/api/aircraft`, { headers: { Origin: 'capacitor://localhost' } });
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).status, 'unavailable');
  assert.equal(unavailable.headers.get('cache-control'), 'no-store');
  const harbor = await fetch(`${base}/api/vessels`, { headers: { Origin: 'capacitor://localhost' } });
  assert.equal(harbor.status, 200);
  assert.equal(harbor.headers.get('access-control-allow-origin'), 'capacitor://localhost');
  assert.equal((await harbor.json()).vessels[0].name, 'CHAMPION');
  const unknown = await fetch(`${base}/api/not-a-route`);
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get('content-type').startsWith('application/json'), true);
});
