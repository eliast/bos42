export function apiBase(value = '', native = false) {
  const configured = String(value).trim();
  if (!configured) {
    if (native) throw new Error('The iPad build needs VITE_API_BASE_URL pointing to the Railway HTTPS service.');
    return '';
  }
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol) || native && url.protocol !== 'https:') throw new Error('Use an HTTPS API address for the iPad app.');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('The API address must be an origin, without credentials, path, query or fragment.');
  if (native && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('The iPad app needs the hosted API address, not localhost.');
  return url.origin;
}
