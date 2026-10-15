import { Capacitor } from '@capacitor/core';
import { apiBase } from '../shared/apiUrl.mjs';

export function apiUrl(path: string) {
  return `${apiBase(import.meta.env.VITE_API_BASE_URL, Capacitor.isNativePlatform())}${path}`;
}
