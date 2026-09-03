---
name: multiplatform-build-engineer
description: Protocolos de compilación, empaquetado multiplataforma (Web Next.js, Android Capacitor APK/AAB y Desktop Electron) y sincronización de versiones en Sugar Ludo.
---

# Multi-Platform Build Engineer (Sugar Ludo)

Esta guía documenta los protocolos de compilación, exportación estática, empaquetado nativo para Android (Capacitor) y distribución de escritorio (Electron) dentro del monorepositorio Sugar Ludo.

---

## 1. Configuración de Next.js para Exportación Multiplataforma

Cuando Next.js se compila para Capacitor o Electron estático, `next.config.mjs` requiere exportación estática con **`trailingSlash: true`** para que las rutas resuelvan archivos físicos `index.html` en el almacenamiento local o WebView nativo:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true, // Esencial para resolución de rutas en Android/Electron
  images: {
    unoptimized: true, // Requerido para exportación estática sin servidor Node
  },
};

export default nextConfig;
```

---

## 2. Pipeline de Compilación Android (Capacitor 8+)

### 2.1 Flujo de Sincronización y Compilación
```bash
# 1. Compilar exportación estática de Next.js
npm run build

# 2. Sincronizar directorio /out y plugins con el proyecto nativo Android
npx cap sync android

# 3. Compilar APK de depuración vía Gradle CLI
cd android && ./gradlew assembleDebug && cd ..

# 4. Compilar APK y Bundle AAB para Google Play Store
cd android && ./gradlew assembleRelease && ./gradlew bundleRelease && cd ..
```

### 2.2 Candado Crítico de Tamaño de APK
> [!WARNING]
> NUNCA compilar instaladores de escritorio (`.exe`, `.zip`) dentro de la carpeta `out/` antes de ejecutar `npx cap sync android`. Si se colocan archivos grandes en `out/`, Capacitor los copiará a los assets de Android, inflando el tamaño del APK a más de 150 MB innecesariamente. Siempre sincronizar Capacitor antes de empaquetar Electron.

---

## 3. Empaquetado Desktop (Electron + electron-builder)

### 3.1 Proceso Principal Seguro (`main.js`)
1. **Protocolo Privilegiado `app://`:** Permite servir el build estático evitando bloqueos de CORS o service workers asociados a `file://`.
2. **Mitigación de Error OAuth Google (`disallowed_useragent`):** Limpiar `app.userAgentFallback` para remover la cadena "Electron" en flujos de autenticación.
3. **Bloqueo de Instancia Única (`requestSingleInstanceLock`):** Evita que el usuario abra múltiples ventanas que colisionen en el juego.

---

## 4. Detección Universal de Plataforma

```typescript
import { Capacitor } from '@capacitor/core';

export type PlatformType = 'web' | 'android' | 'ios' | 'electron';

export function getPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'web';
  if ((window as any).electronAPI) return 'electron';
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() as 'android' | 'ios';
  }
  return 'web';
}

export const isNative = () => typeof window !== 'undefined' && Capacitor.isNativePlatform();
export const isElectron = () => typeof window !== 'undefined' && !!(window as any).electronAPI;
export const isWeb = () => !isNative() && !isElectron();
```

---

## 5. Sincronización Automatizada de Versiones

Un único archivo `package.json` define la versión oficial del producto. El script `sync-version.js` propaga automáticamente la versión hacia:
1. `android/app/version.properties` (`VERSION_NAME` y `VERSION_CODE` calculado: `Major * 10000 + Minor * 100 + Patch`).
2. `android/app/build.gradle`.
3. `sugar-ludo-admin-hub/package.json` y `lib/constants.ts`.
