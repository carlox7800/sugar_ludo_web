'use client'

import React from 'react'
import { Users } from 'lucide-react'
import { ComingSoonScreen } from './coming-soon-screen'

export function FriendsScreen({ onBack }: { onBack: () => void }) {
  return (
    <ComingSoonScreen
      icon={Users}
      title="Amigos"
      description="Conecta con otros jugadores, forma equipos y compite en el ranking."
      accent="var(--candy-cyan)"
      badge="Beta Próxima"
      onBack={onBack}
    />
  )
}
