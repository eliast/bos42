import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deploymentEnv } from './deploy-config.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const team = String(deploymentEnv(root).APPLE_TEAM_ID || '').trim();
if (team && !/^[A-Z0-9]{10}$/.test(team)) throw new Error('APPLE_TEAM_ID must be a 10-character Apple team identifier.');
await writeFile(new URL('../ios/signing.local.xcconfig', import.meta.url),
  `// Generated from local deployment settings. Do not commit.\nBOS42_APPLE_TEAM_ID = ${team}\n`, { mode: 0o600 });
console.log(team ? 'Local Xcode signing team configured.' : 'No APPLE_TEAM_ID configured; unsigned builds remain available.');
