import { NextResponse } from 'next/server'
import { OrderChatMessage } from '../../../../types/cashier'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, senderUid, senderName, senderRole, message, attachmentUrl } = body

    if (!orderId || (!message && !attachmentUrl)) {
      return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })
    }

    const newChatMessage: OrderChatMessage = {
      id: `msg_${Date.now()}`,
      orderId,
      senderUid,
      senderName,
      senderRole,
      message: message || '',
      attachmentUrl,
      attachmentType: attachmentUrl ? 'image' : undefined,
      timestamp: Date.now(),
      isRead: false
    }

    return NextResponse.json({
      success: true,
      message: newChatMessage
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
