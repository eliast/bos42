import { spawnSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { clientBuildEnv } from './deploy-config.mjs';
import { apiBase } from '../shared/apiUrl.mjs';

const env = { ...clientBuildEnv('tizen'), VITE_TIZEN_APP: '1' };
try { env.VITE_API_BASE_URL = apiBase(env.VITE_API_BASE_URL, true); }
catch (error) { console.error(error.message); process.exit(1); }
for (const args of [['tsc', '-b'], ['vite', 'build', '--mode', 'tizen', '--base', './', '--outDir', 'dist-tizen']]) {
  const result = spawnSync('npx', ['--no-install', ...args], { stdio: 'inherit', env });
  if (result.status !== 0) process.exit(result.status || 1);
}
copyFileSync('tizen/config.xml', 'dist-tizen/config.xml');
console.log('Tizen app built in dist-tizen. Sign with the existing Samsung TV certificate profile.');
