import WebSocket from 'ws';
import { AIS_TYPES, HARBOR_BOUNDS, HarborStore } from '../shared/marine.mjs';

export function createHarborService({ apiKey = process.env.AISSTREAM_API_KEY, socketFactory = (url, options) => new WebSocket(url, options), clock = Date.now, random = Math.random, schedule = setTimeout, cancel = clearTimeout } = {}) {
  const store = new HarborStore();
  let socket = null, reconnect = null, heartbeat = null, closed = false, confirmed = false, attempts = 0;
  let lastMessageAt = null, error = null, pongAt = null;
  const clearTimers = () => { if (heartbeat) cancel(heartbeat); heartbeat = null; };
  const again = () => {
    if (closed || reconnect || !apiKey) return;
    const delay = Math.min(120_000, 2000 * 2 ** Math.min(attempts++, 6)) + random() * 1000;
    reconnect = schedule(() => { reconnect = null; connect(); }, delay); reconnect?.unref?.();
  };
  const connect = () => {
    if (closed || socket || !apiKey) return;
    confirmed = false; error = null;
    let current;
    try { current = socketFactory('wss://stream.aisstream.io/v0/stream', { perMessageDeflate: true, handshakeTimeout: 15000, maxPayload: 1024 * 1024 }); }
    catch { error = 'Cannot start the harbor feed. Reconnecting.'; again(); return; }
    socket = current;
    const beat = () => {
      if (socket !== current || closed) return;
      if (clock() - pongAt > 75_000) { error = 'Harbor connection interrupted. Reconnecting.'; current.terminate(); return; }
      if (current.readyState === WebSocket.OPEN) current.ping();
      heartbeat = schedule(beat, 30_000); heartbeat?.unref?.();
    };
    current.on('open', () => {
      if (socket !== current || closed) return;
      pongAt = clock();
      current.send(JSON.stringify({ APIKey: apiKey, BoundingBoxes: [[[HARBOR_BOUNDS.south, HARBOR_BOUNDS.west], [HARBOR_BOUNDS.north, HARBOR_BOUNDS.east]]], FilterMessageTypes: AIS_TYPES }));
      heartbeat = schedule(beat, 30_000); heartbeat?.unref?.();
    });
    current.on('pong', () => { if (socket === current) pongAt = clock(); });
    current.on('message', bytes => {
      if (socket !== current || closed) return;
      let event;
      try { event = JSON.parse(bytes.toString()); } catch { return; }
      if (event.error || event.Error) { error = 'Harbor provider rejected the connection.'; current.terminate(); return; }
      if (event.MessageType === 'SubscriptionConfirmation') { confirmed = true; attempts = 0; error = null; return; }
      if (store.ingest(event, clock())) { lastMessageAt = clock(); confirmed = true; attempts = 0; error = null; }
    });
    current.on('error', () => { if (socket === current) error = 'Cannot reach the harbor feed. Reconnecting.'; });
    current.on('close', () => {
      if (socket !== current) return;
      socket = null; confirmed = false; clearTimers();
      if (!closed) { error ||= 'Harbor connection interrupted. Reconnecting.'; again(); }
    });
  };
  return {
    start() { if (!closed) connect(); },
    stop() { closed = true; if (reconnect) cancel(reconnect); reconnect = null; clearTimers(); const previous = socket; socket = null; previous?.terminate(); },
    getSnapshot() {
      if (!socket && !reconnect && !closed) connect();
      const now = clock(), vessels = store.snapshot(now);
      const recent = lastMessageAt !== null && now - lastMessageAt < 6 * 60_000;
      const status = !apiKey ? 'unconfigured' : confirmed && (recent || lastMessageAt === null) ? 'live' : vessels.length ? 'stale' : error ? 'unavailable' : 'connecting';
      return { status, vessels, serverTime: now, source: 'AISStream', sourceUrl: 'https://aisstream.io/', lastMessageAt, bounds: HARBOR_BOUNDS, error: !apiKey ? 'Harbor feed is not configured.' : error, retryAfterMs: status === 'live' ? 5000 : 10000 };
    },
  };
}
