'use client';

import React, { useEffect } from 'react';
import { ShieldCheck, Download, X, Laptop, Smartphone, AlertCircle, ArrowRight } from 'lucide-react';

interface GamerHUDModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: 'windows' | 'android';
  version?: string;
  downloadUrl: string;
}

export const GamerHUDModal: React.FC<GamerHUDModalProps> = ({
  isOpen,
  onClose,
  platform,
  version = '9.2.8',
  downloadUrl,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isWin = platform === 'windows';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8">
      {/* Fondo atenuado con desenfoque */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity duration-300"
      />

      {/* Contenedor HUD Cyberpunk */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-cyan-500/40 bg-[#0a0518]/95 p-6 sm:p-8 shadow-[0_0_50px_rgba(0,240,255,0.25)] backdrop-blur-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Esquinas biseladas cyberpunk */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${isWin ? 'bg-cyan-500/20 text-cyan-300' : 'bg-pink-500/20 text-pink-300'}`}>
              {isWin ? <Laptop className="size-6" /> : <Smartphone className="size-6" />}
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
                Guía Rápida de Instalación
              </h3>
              <p className="text-xs text-white/50">
                Sugar Ludo v{version} • {isWin ? 'Instalador Oficial para PC Windows' : 'Paquete APK Firmado para Android'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer text-white/50 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/10"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Pasos Interactivos */}
        <div className="grid gap-3.5 mb-7">
          {isWin ? (
            <>
              <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 items-start">
                <div className="size-7 rounded-full bg-cyan-500 text-black font-black flex items-center justify-center shrink-0 text-sm">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Descarga el Instalador Oficial</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Guarda el archivo <code>SugarLudo-Setup.exe</code> (~248 MB) en tu PC.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 items-start">
                <div className="size-7 rounded-full bg-cyan-400 text-black font-black flex items-center justify-center shrink-0 text-sm">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-cyan-300 text-sm flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    Aviso de Windows SmartScreen
                  </h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Al ser un software independiente nuevo, pulsa en <strong>"Más información"</strong> y luego en <strong>"Ejecutar de todas formas"</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 items-start">
                <div className="size-7 rounded-full bg-cyan-500 text-black font-black flex items-center justify-center shrink-0 text-sm">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Inicia Sesión con Google</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Se validará tu cuenta mediante navegador de forma 100% segura y regresarás de inmediato al juego.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 items-start">
                <div className="size-7 rounded-full bg-pink-500 text-white font-black flex items-center justify-center shrink-0 text-sm">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Descarga el Paquete APK</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Descarga directa de <code>SugarLudo.apk</code> (~47 MB) con gráficos optimizados para móviles.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-2xl bg-pink-950/30 border border-pink-500/30 items-start">
                <div className="size-7 rounded-full bg-pink-400 text-black font-black flex items-center justify-center shrink-0 text-sm">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-pink-300 text-sm flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    Permitir Apps de Esta Fuente
                  </h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Si Chrome o tu navegador muestra una advertencia, pulsa <strong>"Descargar de todos modos"</strong> y activa el permiso para instalar.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 items-start">
                <div className="size-7 rounded-full bg-pink-500 text-white font-black flex items-center justify-center shrink-0 text-sm">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Instalar y Entrar a la Arena</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Abre el archivo descargado, presiona "Instalar" e ingresa con Google en segundos.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer con enlace de descarga */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <ShieldCheck className="size-4 shrink-0" />
            <span>Verificado Seguro • Sin Publicidad • Binario Oficial</span>
          </div>

          <a
            href={downloadUrl}
            download
            className={`w-full sm:w-auto px-7 py-3 rounded-2xl font-black uppercase tracking-wider text-center shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${
              isWin 
                ? 'bg-cyan-400 text-black hover:bg-cyan-300 shadow-cyan-500/30' 
                : 'bg-pink-500 text-white hover:bg-pink-400 shadow-pink-500/30'
            }`}
          >
            <Download className="size-4" />
            <span>Descargar Archivo Ahora</span>
          </a>
        </div>
      </div>
    </div>
  );
};
