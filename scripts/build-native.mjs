import { spawnSync } from 'node:child_process';
import { clientBuildEnv } from './deploy-config.mjs';
import { apiBase } from '../shared/apiUrl.mjs';

const env = clientBuildEnv('native');
try { env.VITE_API_BASE_URL = apiBase(env.VITE_API_BASE_URL, true); }
catch (error) { console.error(error.message); process.exit(1); }
for (const args of [['tsc', '-b'], ['vite', 'build', '--mode', 'native', '--outDir', 'dist-native']]) {
  const result = spawnSync('npx', ['--no-install', ...args], { stdio: 'inherit', env });
  if (result.status !== 0) process.exit(result.status || 1);
}
