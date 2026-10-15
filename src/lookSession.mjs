import { calibratedView } from './lookOrientation.mjs';

/** Calibration belongs to a sensor reference frame, not to a camera mode. */
export class LookSession {
  /** @type {string | null} */
  source = null;
  /** @type {{azimuth: number, elevation: number} | null} */
  sample = null;
  /** @type {{origin: {azimuth: number, elevation: number}, bearing: number, tilt: number, explicit: boolean} | null} */
  calibration = null;
  needsAlignment = false;
  sampledAt = 0;

  receive(sample, source, home, now) {
    if (!Number.isFinite(sample.azimuth) || !Number.isFinite(sample.elevation) || !source) return false;
    if (this.source !== null && source !== this.source) this.invalidate();
    this.source = source;
    this.sample = { azimuth: sample.azimuth, elevation: sample.elevation };
    this.sampledAt = now;
    if (!this.calibration && !this.needsAlignment) this.align(home, now, false);
    return true;
  }

  align(home, now, explicit = true) {
    if (!this.sample || now - this.sampledAt > 1000 || !Number.isFinite(home.bearing) || !Number.isFinite(home.tilt)) return false;
    this.calibration = { origin: { ...this.sample }, bearing: home.bearing, tilt: home.tilt, explicit };
    this.needsAlignment = false;
    return true;
  }

  invalidate() {
    this.calibration = null;
    this.sample = null;
    this.needsAlignment = true;
  }

  view(now) {
    if (!this.calibration || !this.sample || this.needsAlignment || now - this.sampledAt > 1000) return null;
    const { origin, bearing, tilt } = this.calibration;
    return calibratedView(this.sample, origin, bearing, tilt);
  }
}
