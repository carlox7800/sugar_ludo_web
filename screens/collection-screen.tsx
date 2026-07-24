'use client'

import React from 'react'
import { LayoutGrid } from 'lucide-react'
import { ComingSoonScreen } from './coming-soon-screen'

export function CollectionScreen({ onBack }: { onBack: () => void }) {
  return (
    <ComingSoonScreen
      icon={LayoutGrid}
      title="Colección"
      description="Visualiza todos tus ítems, logros desbloqueados y estadísticas globales."
      accent="var(--candy-violet)"
      onBack={onBack}
    />
  )
}
