import WebSocket from 'ws';

const key = process.env.AISSTREAM_API_KEY;
if (!key) throw new Error('Set AISSTREAM_API_KEY in the server environment.');
const socket = new WebSocket('wss://stream.aisstream.io/v0/stream', { perMessageDeflate: true, handshakeTimeout: 15000 });
const counts = {}, vessels = new Map();
let confirmed = false;
const finish = () => {
  console.log(JSON.stringify({ confirmed, counts, vessels: vessels.size, sample: [...vessels.values()].slice(0, 8) }));
  socket.close();
  setTimeout(() => process.exit(vessels.size ? 0 : 1), 500).unref();
};
setTimeout(finish, 90000);
socket.on('open', () => socket.send(JSON.stringify({ APIKey: key, BoundingBoxes: [[[42.25, -71.13], [42.45, -70.85]]], FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport', 'ShipStaticData', 'StaticDataReport'] })));
socket.on('message', bytes => {
  let event;
  try { event = JSON.parse(bytes.toString()); } catch { return; }
  if (event.error || event.Error) { console.log('AISStream rejected the subscription.'); return; }
  const type = event.MessageType;
  counts[type] = (counts[type] || 0) + 1;
  if (type === 'SubscriptionConfirmation') {
    confirmed = true;
    console.log(JSON.stringify({ subscription: 'accepted', compression: event.Message?.CompressionEnabled }));
    return;
  }
  const data = event.Message?.[type];
  if (!data) return;
  const id = event.MetaData?.MMSI;
  if (id) vessels.set(id, { name: event.MetaData.ShipName?.trim(), type, lat: event.MetaData.latitude ?? event.MetaData.Latitude, lon: event.MetaData.longitude ?? event.MetaData.Longitude });
  if (counts[type] === 1) console.log(JSON.stringify({ firstMessage: type, metadata: event.MetaData, data }));
});
socket.on('error', () => console.log('AISStream connection error.'));
socket.on('close', code => console.log(JSON.stringify({ connectionClosed: code })));
