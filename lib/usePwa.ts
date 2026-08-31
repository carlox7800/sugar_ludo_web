'use client'

import { useState, useEffect } from 'react'

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isStandalone, setIsStandalone] = useState<boolean>(false)
  const [isInstallable, setIsInstallable] = useState<boolean>(false)
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false)
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>('desktop')

  useEffect(() => {
    // Detect Device Type
    const detectDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      if (/android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent)) {
        setDeviceType('mobile')
      } else {
        setDeviceType('desktop')
      }
    }
    detectDevice()

    // 1. Inicializar estado desde LocalStorage (Sin invocar APIs invasivas de permisos del navegador)
    if (typeof window !== 'undefined') {
      const storedStatus = localStorage.getItem('sugar_ludo_installed')
      if (storedStatus === 'true') {
        setIsAppInstalled(true)
      }
    }

    // Detect if running as installed standalone PWA
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches
      const isIOSStandalone = (navigator as any).standalone === true
      const isAndroidApp = document.referrer.includes('android-app://')
      const isPwaUrl = window.location.search.includes('mode=pwa')
      
      setIsStandalone(isStandaloneMedia || isIOSStandalone || isAndroidApp || isPwaUrl)
    }

    checkStandalone()

    const mediaQueryStandalone = window.matchMedia('(display-mode: standalone)')
    const mediaQueryFullscreen = window.matchMedia('(display-mode: fullscreen)')
    
    const handleMediaChange = () => {
      checkStandalone()
    }

    if (mediaQueryStandalone.addEventListener) {
      mediaQueryStandalone.addEventListener('change', handleMediaChange)
      mediaQueryFullscreen.addEventListener('change', handleMediaChange)
    } else {
      mediaQueryStandalone.addListener(handleMediaChange)
      mediaQueryFullscreen.addListener(handleMediaChange)
    }

    // Capture the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
      // Si el evento salta, definitivamente NO está instalada en el dispositivo (o se desinstaló)
      setIsAppInstalled(false) 
      localStorage.setItem('sugar_ludo_installed', 'false')
    }

    // Listen when installation succeeds
    const handleAppInstalled = () => {
      setIsAppInstalled(true)
      localStorage.setItem('sugar_ludo_installed', 'true')
      setDeferredPrompt(null)
      setIsInstallable(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)



    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      if (mediaQueryStandalone.removeEventListener) {
        mediaQueryStandalone.removeEventListener('change', handleMediaChange)
        mediaQueryFullscreen.removeEventListener('change', handleMediaChange)
      } else {
        mediaQueryStandalone.removeListener(handleMediaChange)
        mediaQueryFullscreen.removeListener(handleMediaChange)
      }
    }
  }, [deferredPrompt])

  const promptInstall = async () => {
    if (!deferredPrompt) {
      return false
    }

    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsInstallable(false)
        setIsAppInstalled(true)
        localStorage.setItem('sugar_ludo_installed', 'true')
        return true
      }
    } catch (e) {
      console.error('Install prompt error', e)
    }
    
    return false
  }

  return {
    isStandalone,
    isInstallable,
    isAppInstalled,
    deviceType,
    promptInstall,
    hasDeferredPrompt: !!deferredPrompt,
  }
}
