import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { lookDirection } from './lookOrientation.mjs';

export type MotionSample = { azimuth: number; elevation: number; sessionID: string };
type MotionEvent = Partial<MotionSample> & { type: 'sample' | 'reset' | 'error'; message?: string };
interface NativeMotion {
  start(): Promise<{ sessionID: string }>;
  stop(): Promise<void>;
  addListener(name: 'motion', callback: (event: MotionEvent) => void): Promise<PluginListenerHandle>;
}
const nativeMotion = registerPlugin<NativeMotion>('WindowMotion');
type PermissionEvent = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

export async function startMotionInput(onSample: (sample: MotionSample) => void, onReset: () => void, onError: (message: string) => void): Promise<() => void> {
  if (Capacitor.isNativePlatform()) {
    const listener = await nativeMotion.addListener('motion', event => {
      if (event.type === 'reset') onReset();
      else if (event.type === 'error') onError(event.message || 'Motion readings stopped. Tap the target to retry.');
      else if (typeof event.sessionID === 'string' && Number.isFinite(event.azimuth) && Number.isFinite(event.elevation)) onSample(event as MotionSample);
    });
    try { await nativeMotion.start(); }
    catch (error) { await listener.remove(); throw error; }
    return () => { void listener.remove(); void nativeMotion.stop(); };
  }
  if (!('DeviceOrientationEvent' in window)) throw new Error('Motion is unavailable here. Use Explore to move the map.');
  const permission = (window.DeviceOrientationEvent as PermissionEvent).requestPermission;
  if (permission && await permission.call(window.DeviceOrientationEvent) !== 'granted') throw new Error('Motion access was declined. Use Explore to move the map.');
  let sessionID = crypto.randomUUID();
  const orientation = (event: DeviceOrientationEvent) => {
    if (document.hidden) return;
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    const direction = lookDirection(event.alpha, event.beta, event.gamma, Number(angle));
    if (direction) onSample({ ...direction, sessionID });
  };
  const visibility = () => {
    if (document.hidden) { sessionID = crypto.randomUUID(); onReset(); }
  };
  window.addEventListener('deviceorientation', orientation);
  document.addEventListener('visibilitychange', visibility);
  return () => { window.removeEventListener('deviceorientation', orientation); document.removeEventListener('visibilitychange', visibility); };
}
