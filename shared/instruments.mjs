const finite = value => typeof value === 'number' && Number.isFinite(value);

/** Keep legacy feeds conservative: their zero may mean missing telemetry. */
export function instrumentReadings(aircraft) {
  const speedKnown = aircraft.speedKnown ?? aircraft.speedKts > 0;
  const rateKnown = aircraft.verticalRateKnown ?? aircraft.verticalRateFpm !== 0;
  return {
    speed: speedKnown && finite(aircraft.speedKts) && aircraft.speedKts >= 0 ? aircraft.speedKts : null,
    altitude: !aircraft.ground && finite(aircraft.altitudeFt) ? aircraft.altitudeFt : null,
    altitudeUnit: aircraft.ground ? 'ON GROUND' : aircraft.altitudeSource === 'geometric' ? 'FT MSL' : 'FT BARO',
    verticalSpeed: !aircraft.ground && rateKnown && finite(aircraft.verticalRateFpm) ? aircraft.verticalRateFpm : null,
    track: aircraft.headingKnown && finite(aircraft.heading) && aircraft.heading >= 0 && aircraft.heading <= 360 ? aircraft.heading % 360 : null,
  };
}

/** Unwrap successive headings so a 359° → 1° turn moves only two degrees. */
export function continueAngle(previous, next) {
  return previous + ((next - previous) % 360 + 540) % 360 - 180;
}

export function dialAngle(value, min, max, start, end) {
  return start + Math.min(1, Math.max(0, (value - min) / (max - min))) * (end - start);
}
