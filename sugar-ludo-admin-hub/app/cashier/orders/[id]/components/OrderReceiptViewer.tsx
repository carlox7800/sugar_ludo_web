'use client'

import React from 'react'
import { Eye } from 'lucide-react'
import { ReceiptImageViewer } from '@/components/receipts/ReceiptImageViewer'

export interface OrderReceiptViewerProps {
  receiptUrl?: string
  receiptReferenceNumber?: string
  paymentMethod: string
  amountFiat: number
  currency: string
  isOpen: boolean
  activeReceiptUrl: string
  onOpenModal: (url: string) => void
  onCloseModal: () => void
}

export const OrderReceiptViewer: React.FC<OrderReceiptViewerProps> = ({
  receiptUrl,
  receiptReferenceNumber,
  paymentMethod,
  amountFiat,
  currency,
  isOpen,
  activeReceiptUrl,
  onOpenModal,
  onCloseModal
}) => {
  return (
    <>
      {/* Receipt Preview Thumbnail (solo si existe comprobante adjunto) */}
      {receiptUrl && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300">Comprobante Bancario</span>
            <button
              type="button"
              onClick={() => onOpenModal(receiptUrl)}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-bold cursor-pointer"
            >
              <Eye className="size-3.5" />
              <span>Inspeccionar en HD</span>
            </button>
          </div>

          <div
            onClick={() => onOpenModal(receiptUrl)}
            className="group relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 cursor-pointer aspect-video flex items-center justify-center"
          >
            <img
              src={receiptUrl}
              alt="Comprobante"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs">
              <Eye className="size-5 text-cyan-300" />
              <span>Abrir Visor con Zoom</span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Receipt Viewer Modal */}
      <ReceiptImageViewer
        isOpen={isOpen}
        onClose={onCloseModal}
        imageUrl={activeReceiptUrl}
        referenceNumber={receiptReferenceNumber}
        bankName={paymentMethod}
        amount={`${amountFiat.toLocaleString()} ${currency}`}
      />
    </>
  )
}
