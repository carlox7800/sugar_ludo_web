import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aistudio.sweetyludo.kxmpzq',
  appName: 'Sugar Ludo',
  webDir: 'out',
  server: {
    allowNavigation: ['*.firebaseapp.com', '*.googleapis.com', 'accounts.google.com']
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
