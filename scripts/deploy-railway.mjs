import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { deploymentEnv, railwayArgs } from './deploy-config.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
let args;
try { args = railwayArgs(deploymentEnv(root), path.join(root, '.railway-build')); }
catch (error) { console.error(error.message); process.exit(1); }
for (const [command, params] of [['npm', ['run', 'check:railway']], ['railway', args]]) {
  const result = spawnSync(command, params, { cwd: root, stdio: 'inherit' });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
