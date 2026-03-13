import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'bd.luckywin.app',
  appName: 'Lucky Win BD',
  webDir: 'dist',
  backgroundColor: '#061125',
  android: {
    backgroundColor: '#061125',
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
