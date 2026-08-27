'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface AccordionBlockProps {
  id: string
  title: string
  subtitle?: string
  icon?: React.ReactNode
  badgeSummary?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

export function AccordionBlock({
  id,
  title,
  subtitle,
  icon,
  badgeSummary,
  defaultOpen = false,
  children
}: AccordionBlockProps) {
  const storageKey = `sugar_ludo_accordion_${id}`
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen)
  const [isMounted, setIsMounted] = useState<boolean>(false)

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved !== null) {
        setIsOpen(saved === 'true')
      }
    } catch {}
    setIsMounted(true)
  }, [storageKey])

  const handleToggle = () => {
    const nextState = !isOpen
    setIsOpen(nextState)
    try {
      localStorage.setItem(storageKey, String(nextState))
    } catch {}
  }

  return (
    <div className="rounded-3xl bg-slate-900/60 border border-white/10 overflow-hidden transition-all duration-200 shadow-sm">
      {/* Clickable Header Bar */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full p-5 flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 hover:bg-slate-800/60 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
              {title}
            </h3>
            {subtitle && <p className="text-[11px] text-slate-400 font-mono mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {badgeSummary && <div className="text-xs">{badgeSummary}</div>}
          <div className="p-1.5 rounded-xl bg-white/5 text-slate-400 border border-white/5">
            {isOpen ? <ChevronUp className="size-4 text-cyan-400" /> : <ChevronDown className="size-4 text-slate-400" />}
          </div>
        </div>
      </button>

      {/* Expandable Body */}
      {isOpen && (
        <div className="p-6 border-t border-white/5 bg-black/20 animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  )
}
