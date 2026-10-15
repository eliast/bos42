import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const stage = path.join(root, '.railway-build');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))).flat();
}
const files = await walk(stage);
for (const file of files) {
  const name = path.relative(stage, file);
  assert(!name.split(path.sep).some(part => /^(src|ios|tizen|public|node_modules)$/.test(part)), `Unexpected deployment directory: ${name}`);
  assert(!/^(\.env)|\.(p12|p8|key|pri|pwd|ipa|wgt)$/.test(name), `Unexpected private/generated file: ${name}`);
  if (!name.endsWith('.mjs')) continue;
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g)) {
    const dependency = path.resolve(path.dirname(file), match[1]);
    assert(dependency.startsWith(stage + path.sep), `Import escapes staging: ${name}`);
    await readFile(dependency);
  }
}
const legacyDockerfile = await readFile(path.join(stage, 'Dockerfile'), 'utf8');
const rootDockerfile = await readFile(path.join(root, 'Dockerfile'), 'utf8');
assert.equal(rootDockerfile.replace('COPY deploy/railway/package.json deploy/railway/package-lock.json ./', 'COPY package.json package-lock.json ./'), legacyDockerfile, 'Root and staged Dockerfiles differ beyond the package source paths');
const api = JSON.parse(await readFile(path.join(stage, 'package.json'), 'utf8'));
assert.equal(api.dependencies.react, undefined, 'API deployment includes frontend dependencies');
console.log(`Railway staging verified: ${files.length} files, all relative imports present, API-only dependencies, matching Dockerfiles.`);
