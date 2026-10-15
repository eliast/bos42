import { mkdir, copyFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const stage = path.join(root, '.railway-build');
// An explicit upload allowlist keeps the personal camera configuration, native
// bundle, local environment files and unrelated workspace projects off Railway.
const files = ['server/index.mjs', 'server/start.mjs', 'server/app.mjs', 'server/feed.mjs', 'server/weather.mjs', 'server/faaStatus.mjs', 'server/harbor.mjs', 'server/journey.mjs', 'server/flightStory.mjs', 'shared/aviation.mjs', 'shared/marine.mjs', 'shared/journey.mjs', 'shared/approaches.mjs'];
await rm(stage, { recursive: true, force: true });
for (const name of files) {
  const to = path.join(stage, name);
  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(path.join(root, name), to);
}
for (const name of ['Dockerfile', 'railway.json', 'package.json', 'package-lock.json']) await copyFile(path.join(root, 'deploy/railway', name), path.join(stage, name));
await writeFile(path.join(stage, '.dockerignore'), 'node_modules\n.git\n.env*\n');
console.log(`API-only deployment staged at ${stage}`);
console.log(`${files.length + 5} files; no frontend, window coordinates, native app or environment files.`);
