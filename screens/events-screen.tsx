'use client'

import React from 'react'
import { CalendarDays } from 'lucide-react'
import { ComingSoonScreen } from './coming-soon-screen'

export function EventsScreen({ onBack }: { onBack: () => void }) {
  return (
    <ComingSoonScreen
      icon={CalendarDays}
      title="Eventos"
      description="Participa en torneos de temporada y gana recompensas únicas."
      accent="var(--candy-orange)"
      onBack={onBack}
    />
  )
}
