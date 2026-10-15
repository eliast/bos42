import express from 'express';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { createApp } from './app.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const localHarborEnv = path.join(root, '.env.harbor.local');
if (existsSync(localHarborEnv)) loadEnvFile(localHarborEnv);
const app = createApp(), server = createServer(app);
app.locals.harbor.start();
app.locals.stories.start();
app.locals.feed.start();
const port = Number(process.env.PORT || 4242), host = process.env.HOST || '0.0.0.0';
if (process.env.BOS42_API_ONLY === '1') {
  app.get('/', (_req, res) => res.json({ app: 'BOS/42', service: 'Flight data API', health: '/api/health' }));
  app.use((_req, res) => res.status(404).json({ error: 'This service only serves flight data' }));
} else if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(root, 'dist'), { etag: true, maxAge: '1h' }));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ root, server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  app.use(vite.middlewares);
}
server.listen(port, host, () => {
  console.log(`BOS/42 running at http://localhost:${port}`);
  if (host === '0.0.0.0' && process.env.BOS42_API_ONLY !== '1') for (const entries of Object.values(networkInterfaces())) for (const item of entries || []) if (item.family === 'IPv4' && !item.internal) console.log(`iPad on the same Wi-Fi: http://${item.address}:${port}`);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
process.once('SIGTERM', () => {
  app.locals.feed.stop();
  app.locals.harbor.stop();
  void app.locals.stories.stop().finally(()=>server.close(() => process.exit(0)));
  setTimeout(() => process.exit(0), 10000).unref();
});
