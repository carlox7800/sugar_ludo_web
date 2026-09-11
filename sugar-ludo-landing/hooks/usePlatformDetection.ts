'use client';

import { useState, useEffect } from 'react';
import { 
  APP_VERSION, 
  PC_DOWNLOAD_URL, 
  ANDROID_DOWNLOAD_URL, 
  PC_FILE_SIZE, 
  ANDROID_FILE_SIZE 
} from '@/lib/constants';

export type OperatingSystem = 'windows' | 'android' | 'mac' | 'ios' | 'linux' | 'unknown';

export interface PlatformInfo {
  os: OperatingSystem;
  isWindows: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  primaryCTA: {
    title: string;
    subtext: string;
    target: 'windows' | 'android';
    badge: string;
    downloadUrl: string;
    size: string;
  };
}

export function usePlatformDetection(): PlatformInfo {
  const [os, setOs] = useState<OperatingSystem>('unknown');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent.toLowerCase();

    if (/android/i.test(ua)) {
      setOs('android');
    } else if (/win/i.test(ua)) {
      setOs('windows');
    } else if (/macintosh|mac os x/i.test(ua)) {
      setOs('mac');
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      setOs('ios');
    } else if (/linux/i.test(ua)) {
      setOs('linux');
    }
  }, []);

  const isWindows = os === 'windows';
  const isAndroid = os === 'android';
  const isMobile = isAndroid || os === 'ios';
  const isDesktop = isWindows || os === 'mac' || os === 'linux' || os === 'unknown';

  const primaryCTA = isAndroid
    ? {
        title: 'Descargar para Android',
        subtext: `APK Oficial v${APP_VERSION} • ${ANDROID_FILE_SIZE}`,
        target: 'android' as const,
        badge: 'Detectado para tu Dispositivo',
        downloadUrl: ANDROID_DOWNLOAD_URL,
        size: ANDROID_FILE_SIZE,
      }
    : {
        title: 'Descargar para PC (Windows)',
        subtext: `Instalador Oficial v${APP_VERSION} • ${PC_FILE_SIZE}`,
        target: 'windows' as const,
        badge: isWindows ? 'Recomendado para tu PC' : 'Edición de Escritorio',
        downloadUrl: PC_DOWNLOAD_URL,
        size: PC_FILE_SIZE,
      };

  return {
    os,
    isWindows,
    isAndroid,
    isMobile,
    isDesktop,
    primaryCTA,
  };
}
