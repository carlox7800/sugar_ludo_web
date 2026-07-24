'use client'

import React from 'react'
import { Mail } from 'lucide-react'
import { ComingSoonScreen } from './coming-soon-screen'

export function MailScreen({ onBack }: { onBack: () => void }) {
  return (
    <ComingSoonScreen
      icon={Mail}
      title="Correo"
      description="Recibe noticias, regalos diarios y notificaciones del sistema."
      accent="var(--candy-magenta)"
      onBack={onBack}
    />
  )
}
