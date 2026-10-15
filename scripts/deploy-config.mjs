import { loadEnv } from 'vite';

export function deploymentEnv(root = process.cwd(), overrides = process.env) {
  return { ...loadEnv('deploy', root, ''), ...overrides };
}

export function clientBuildEnv(mode, root = process.cwd(), overrides = process.env) {
  const env = { ...deploymentEnv(root, {}), ...loadEnv(mode, root, ''), ...overrides };
  // An explicit per-platform VITE override wins over the shared deployment URL.
  env.VITE_API_BASE_URL = env.VITE_API_BASE_URL || env.API_BASE_URL;
  return env;
}

export function required(env, name) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`Set ${name} in .env.deploy.local or the process environment.`);
  return value;
}

export function railwayArgs(env, stage) {
  return ['up', stage, '--path-as-root', '--no-gitignore',
    '--project', required(env, 'RAILWAY_PROJECT_ID'),
    '--service', required(env, 'RAILWAY_SERVICE_ID'),
    '--environment', required(env, 'RAILWAY_ENVIRONMENT'), '--detach'];
}
