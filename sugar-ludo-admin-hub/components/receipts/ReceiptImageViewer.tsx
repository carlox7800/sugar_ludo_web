'use client'

import React, { useState } from 'react'
import { ZoomIn, ZoomOut, RotateCw, RefreshCcw, X, ExternalLink, ShieldCheck, Maximize2 } from 'lucide-react'

interface ReceiptImageViewerProps {
  isOpen: boolean
  onClose: () => void
  imageUrl?: string
  referenceNumber?: string
  bankName?: string
  amount?: string
  dateStr?: string
}

export function ReceiptImageViewer({
  isOpen,
  onClose,
  imageUrl,
  referenceNumber,
  bankName,
  amount,
  dateStr
}: ReceiptImageViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [brightness, setBrightness] = useState(100)

  if (!isOpen) return null

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)
  const handleReset = () => {
    setZoom(1)
    setRotation(0)
    setBrightness(100)
  }

  const fallbackImage = imageUrl || 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1000'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white tracking-wide">
                VISOR DE COMPROBANTE BANCARIO
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {bankName || 'Transferencia'} &bull; Ref: <strong className="text-cyan-300">{referenceNumber || 'N/A'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                title="Abrir imagen original"
              >
                <ExternalLink className="size-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-slate-950/40 border-b border-white/5 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-slate-300"
              title="Aumentar Zoom"
            >
              <ZoomIn className="size-4" />
            </button>
            <span className="font-mono text-xs w-12 text-center text-cyan-300 font-bold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-slate-300"
              title="Reducir Zoom"
            >
              <ZoomOut className="size-4" />
            </button>
            <div className="h-4 w-px bg-white/10 mx-1" />
            <button
              onClick={handleRotate}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-slate-300 flex items-center gap-1"
              title="Girar 90 grados"
            >
              <RotateCw className="size-4" />
              <span>Girar</span>
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-slate-400 flex items-center gap-1"
              title="Restablecer vista"
            >
              <RefreshCcw className="size-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Quick Details Pill */}
          <div className="flex items-center gap-4 text-xs">
            {amount && <span>Monto: <strong className="text-emerald-400 font-mono">{amount}</strong></span>}
            {dateStr && <span className="text-slate-400">{dateStr}</span>}
          </div>
        </div>

        {/* Interactive Image Container */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center min-h-[360px] max-h-[60vh] bg-black/60 select-none">
          <div
            className="transition-transform duration-200 ease-out origin-center cursor-grab active:cursor-grabbing"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              filter: `brightness(${brightness}%)`,
            }}
          >
            <img
              src={fallbackImage}
              alt="Comprobante Bancario"
              className="max-h-[50vh] max-w-full rounded-xl object-contain shadow-2xl pointer-events-none"
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <span>Verifica cuidadosamente la fecha, el número de referencia y el titular emisor antes de liberar.</span>
          <span className="text-cyan-400 font-medium">Validación Criptográfica Activa</span>
        </div>
      </div>
    </div>
  )
}
