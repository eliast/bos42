import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { deploymentEnv, clientBuildEnv, railwayArgs } from '../scripts/deploy-config.mjs';

async function fixture(t) {
  // Vite intentionally reads process.env even when helper overrides are empty.
  // Keep tests independent of API URLs configured by CI or a developer shell.
  const names = ['API_BASE_URL', 'VITE_API_BASE_URL', 'APPLE_TEAM_ID'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  t.after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
  const root = await mkdtemp(path.join(tmpdir(), 'bos42-deploy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('clients share the local API origin without changing browser development', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, '.env.deploy.local'), 'API_BASE_URL=https://shared.example\n');
  for (const mode of ['native', 'tizen']) assert.equal(clientBuildEnv(mode, root, {}).VITE_API_BASE_URL, 'https://shared.example');
  const { loadEnv } = await import('vite');
  assert.equal(loadEnv('development', root, 'VITE_').VITE_API_BASE_URL, undefined);
});

test('platform and process settings override deployment-file defaults', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, '.env.deploy.local'), 'API_BASE_URL=https://shared.example\nAPPLE_TEAM_ID=AAAAAAAAAA\n');
  await writeFile(path.join(root, '.env.tizen.local'), 'VITE_API_BASE_URL=https://tv.example\n');
  assert.equal(clientBuildEnv('tizen', root, {}).VITE_API_BASE_URL, 'https://tv.example');
  assert.equal(clientBuildEnv('tizen', root, { VITE_API_BASE_URL: 'https://process.example' }).VITE_API_BASE_URL, 'https://process.example');
  assert.equal(deploymentEnv(root, { APPLE_TEAM_ID: 'BBBBBBBBBB' }).APPLE_TEAM_ID, 'BBBBBBBBBB');
});

test('Railway deployment requires explicit destination and uploads only staging', () => {
  assert.throws(() => railwayArgs({}, '/tmp/stage'), /RAILWAY_PROJECT_ID/);
  assert.throws(() => railwayArgs({ RAILWAY_PROJECT_ID: 'project', RAILWAY_SERVICE_ID: 'service' }, '/tmp/stage'), /RAILWAY_ENVIRONMENT/);
  const args = railwayArgs({ RAILWAY_PROJECT_ID: 'project', RAILWAY_SERVICE_ID: 'service', RAILWAY_ENVIRONMENT: 'production' }, '/tmp/stage');
  assert.deepEqual(args, ['up', '/tmp/stage', '--path-as-root', '--no-gitignore', '--project', 'project', '--service', 'service', '--environment', 'production', '--detach']);
});

test('TV deployment reads local defaults and CLI overrides without contacting devices', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'scripts'));
  await mkdir(path.join(root, 'tizen'));
  await copyFile(new URL('../scripts/deploy-tizen.py', import.meta.url), path.join(root, 'scripts/deploy-tizen.py'));
  await copyFile(new URL('../tizen/config.xml', import.meta.url), path.join(root, 'tizen/config.xml'));
  await writeFile(path.join(root, '.env.deploy.local'), 'TV_HOST=192.0.2.10\nTIZEN_SIGNING_PROFILE="Example Profile"\n');
  const env = { ...process.env };
  delete env.TV_HOST; delete env.TIZEN_SIGNING_PROFILE;
  const command = path.join(root, 'scripts/deploy-tizen.py');
  const run = extra => spawnSync('python3', [command, '--dry-run', ...extra], { env, encoding: 'utf8' });
  const local = run([]);
  assert.equal(local.status, 0, local.stderr);
  assert.match(local.stdout, /192\.0\.2\.10:26101/);
  assert.match(local.stdout, /Example Profile/);
  const override = run(['--host', '192.0.2.20', '--profile', 'Override']);
  assert.equal(override.status, 0, override.stderr);
  assert.match(override.stdout, /192\.0\.2\.20:26101/);
  assert.match(override.stdout, /Override/);
  assert.doesNotMatch(override.stdout, /192\.0\.2\.10/);
});
