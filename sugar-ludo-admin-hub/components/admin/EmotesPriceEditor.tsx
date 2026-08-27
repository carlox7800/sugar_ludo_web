'use client'

import React from 'react'
import { StoreItemPriceConfig } from '../../types/treasury'
import { Smile, Sparkles, CheckCircle2, Lock } from 'lucide-react'

interface EmotesPriceEditorProps {
  emotes: StoreItemPriceConfig[]
  onUpdateEmote: (id: string, newCoins: number) => void
}

export function EmotesPriceEditor({ emotes, onUpdateEmote }: EmotesPriceEditorProps) {
  // Los 5 emotes base gratuitos del juego (definidos en DEFAULT_BASE_EMOTE_IDS)
  const baseFreeEmotes = [
    { id: 'emote_lol_bounce', name: 'Risa en Bucle (LOL)', icon: '🤣', desc: 'Rebote elástico continuo' },
    { id: 'emote_on_fire', name: 'En Llamas (On Fire)', icon: '🔥', desc: 'Llamarada viva para intimidar' },
    { id: 'emote_sad_cry', name: 'Lágrimas (Sad Cry)', icon: '😭', desc: 'Cascada cómica de lágrimas' },
    { id: 'emote_sugar_love', name: 'Sugar Love (Corazón)', icon: '💖', desc: 'Corazones dulces flotantes' },
    { id: 'emote_trophy_gg', name: 'Copa GG (Victoria)', icon: '🏆', desc: 'Trofeo dorado brillante' }
  ]

  const premiumPaidEmotes = emotes.filter((e) => e.category === 'emote')

  return (
    <div className="space-y-5">
      {/* 1. Emotes Base Gratuitos */}
      <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-400" /> 5 EMOTES BASE GRATUITOS (INCLUIDOS EN RUEDA)
          </span>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">0 SC / Desbloqueo Universal</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {baseFreeEmotes.map((b) => (
            <div key={b.id} className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5 text-center space-y-1">
              <span className="text-2xl block">{b.icon}</span>
              <span className="font-bold text-[11px] text-white block truncate">{b.name}</span>
              <span className="text-[9px] text-slate-400 block">{b.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Emotes de Pago Reales (5 Premium de la Tienda) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Smile className="size-3.5 text-amber-400" /> 5 EMOTES PREMIUM DE PAGO (EDITABLES)
          </span>
          <span className="text-[10px] font-mono text-slate-400">Precios en SC y USDT</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {premiumPaidEmotes.map((item) => (
            <div key={item.id} className="p-3.5 rounded-2xl bg-slate-950/90 border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{item.icon || '✨'}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-mono uppercase font-bold">
                  {item.rarity || 'Premium'}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="font-bold text-xs text-white block truncate">{item.name}</span>
                <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">{item.description}</p>
              </div>

              <div className="pt-2 border-t border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Precio SC:</span>
                  <input
                    type="number"
                    value={item.priceCoins}
                    onChange={(e) => onUpdateEmote(item.id, parseInt(e.target.value) || 0)}
                    className="w-16 bg-slate-900 border border-white/10 rounded-xl px-2 py-1 text-xs font-mono font-bold text-cyan-300 text-right"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Equivalente:</span>
                  <span className="font-bold text-emerald-400">${item.priceUSDT.toFixed(2)} USDT</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
