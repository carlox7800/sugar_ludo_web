'use client'

import React from 'react'
import { OrderChatPanel } from '@/components/chat/OrderChatPanel'
import { OrderChatMessage, OrderStatus } from '@/types/cashier'

export interface OrderChatStreamProps {
  orderId: string
  orderStatus: OrderStatus
  messages: OrderChatMessage[]
  playerReadAt?: number
  currentUserUid: string
  currentUserName: string
  onSendMessage: (text: string, attachmentUrl?: string) => Promise<void>
  onViewImage: (url: string) => void
  onOpenDisputeModal: () => void
}

export const OrderChatStream: React.FC<OrderChatStreamProps> = ({
  orderId,
  orderStatus,
  messages,
  playerReadAt,
  currentUserUid,
  currentUserName,
  onSendMessage,
  onViewImage,
  onOpenDisputeModal
}) => {
  return (
    <div className="lg:col-span-7 h-[calc(100vh-180px)] min-h-[520px]">
      <OrderChatPanel
        orderId={orderId}
        currentUserUid={currentUserUid}
        currentUserName={currentUserName}
        currentUserRole="cashier"
        messages={messages}
        counterpartReadAt={playerReadAt || 0}
        isOrderResolved={orderStatus === 'completed'}
        onSendMessage={onSendMessage}
        onViewImage={onViewImage}
        isDisputed={orderStatus === 'disputed'}
        onOpenDisputeModal={onOpenDisputeModal}
      />
    </div>
  )
}
