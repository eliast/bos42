// TV browsers often drive a 4K panel with a much smaller GPU than a laptop.
// Keep the DOM sharp while limiting only the map's WebGL drawing buffer.
export function isTelevision(userAgent = '') {
  return /Tizen|Smart[ -]?TV|SMART-TV|HbbTV|NetCast|Web0S|WebOS/i.test(userAgent);
}

export function mapPixelRatio(width, height, devicePixelRatio, television) {
  const nativeRatio = Math.min(Math.max(devicePixelRatio || 1, .25), 2);
  if (!television || width <= 0 || height <= 0) return nativeRatio;
  return Math.min(nativeRatio, Math.sqrt((1920 * 1080) / (width * height)));
}

export const televisionRenderer = typeof navigator !== 'undefined' && isTelevision(navigator.userAgent);
