'use client'

import React from 'react'
import { Store } from 'lucide-react'
import { ComingSoonScreen } from './coming-soon-screen'

export function StoreScreen({ onBack }: { onBack: () => void }) {
  return (
    <ComingSoonScreen
      icon={Store}
      title="Tienda"
      description="Adquiere nuevos tableros, dados y avatares exclusivos."
      accent="var(--candy-gold)"
      onBack={onBack}
    />
  )
}
