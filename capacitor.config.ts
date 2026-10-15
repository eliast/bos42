import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'us.torrez.bos42',
  appName: 'BOS/42',
  webDir: 'dist-native',
  backgroundColor: '#10191e',
  // Ship the interface inside the app. Only data requests go to Railway.
  server: { hostname: 'localhost', iosScheme: 'capacitor' },
  ios: { contentInset: 'never', scrollEnabled: false, backgroundColor: '#10191e' },
};
export default config;
