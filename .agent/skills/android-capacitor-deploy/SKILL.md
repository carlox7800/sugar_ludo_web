---
name: android-capacitor-deploy
description: Protocolos y candados técnicos para la sincronización, empaquetado y generación de ejecutables móviles (Android) y de escritorio (Electron/Capacitor) en Sugar Ludo.
---

# Android & Capacitor Deploy Guard (Sugar Ludo)

Esta skill define el procedimiento estándar para sincronizar y compilar las versiones descargables de Sugar Ludo sin afectar el código web ni los permisos nativos.

## 1. Sincronización Web -> Android
- Antes de sincronizar o empaquetar, compilar el frontend web de producción:
  `powershell
  cmd /c  npm run build
  `
- Sincronizar el directorio de salida estática con el proyecto de Android:
  `powershell
  cmd /c npx cap sync android
  `

## 2. Permisos Silenciosos y WebViews
- **Permisos del Sistema:** Mantener AndroidManifest.xml libre de permisos invasivos que disparen alertas innecesarias al usuario.
- **Portapapeles y Utilidades DOM:** Usar siempre copyToClipboardSilently() desde lib/utils.ts para evitar que el WebView de Android active el diálogo de *Acceder a otras aplicaciones y servicios*.
- **Configuración de Red / Cleartext:** Verificar 
etwork_security_config.xml si se requiere comunicación HTTP local con servidores de desarrollo.

## 3. Preparación de Versiones de Escritorio / APKs
- Mantener aislados los assets de audio y gráficos para no sobrecargar el tamaño final del paquete.
- Comprobar que las rutas dinámicas y assets relativos carguen de forma consistente tanto en el entorno web como en el contenedor nativo.
