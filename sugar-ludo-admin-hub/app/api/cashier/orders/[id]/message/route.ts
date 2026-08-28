import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { OrderChatMessage } from '@/types/cashier'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'cashier_orders.json')

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const body = await request.json()
    const { message, senderName, senderUid, senderRole, attachmentUrl } = body

    if (!orderId || !message) {
      return NextResponse.json({ success: false, error: 'Mensaje u orden inválida' }, { status: 400 })
    }

    const timestamp = Date.now()
    const msgId = `msg_${timestamp}_${Math.random().toString(36).slice(2, 6)}`

    const newChatMessage: OrderChatMessage = {
      id: msgId,
      orderId,
      senderUid: senderUid || 'csh_primary',
      senderName: senderName || 'Cajero',
      senderRole: senderRole || 'cashier',
      message: message.trim(),
      attachmentUrl,
      attachmentType: attachmentUrl ? 'image' : undefined,
      timestamp,
      isRead: false
    }

    let playerUid = ''
    let orderData: any = null

    // 1. Resolver playerUid desde disco local o Firestore
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8')
        const orders = JSON.parse(raw || '[]')
        orderData = orders.find((o: any) => o.id === orderId)
        if (orderData) {
          playerUid = orderData.playerUid
        }
      }
    } catch {}

    if (adminDb && adminDb.collection) {
      try {
        if (!playerUid) {
          const orderDoc = await adminDb.collection('cashier_orders').doc(orderId).get()
          if (orderDoc.exists) {
            orderData = orderDoc.data()
            playerUid = orderData.playerUid
          }
        }

        // Guardar mensaje en subcolección de chat de la orden
        await adminDb.collection('cashier_orders').doc(orderId).collection('messages').doc(msgId).set(newChatMessage)

        // Inyectar / Actualizar correo en la bandeja de Soporte del jugador
        if (playerUid) {
          const userRef = adminDb.collection('users').doc(playerUid)
          const userDoc = await userRef.get()
          if (userDoc.exists) {
            const userData = userDoc.data() || {}
            const inbox = Array.isArray(userData.inbox) ? userData.inbox : []
            
            const supportMailId = `mail_sup_${orderId}`
            const existingMailIndex = inbox.findIndex((m: any) => m.id === supportMailId || m.orderId === orderId)
            
            const replyItem = {
              id: msgId,
              sender: senderName || 'Cajero',
              senderRole: 'cashier',
              message: message.trim(),
              timestamp,
              attachmentUrl
            }

            if (existingMailIndex !== -1) {
              const currentMail = inbox[existingMailIndex]
              const currentReplies = Array.isArray(currentMail.replies) ? currentMail.replies : []
              inbox[existingMailIndex] = {
                ...currentMail,
                content: message.trim(),
                isRead: false,
                timestamp,
                date: 'Hoy',
                replies: [...currentReplies, replyItem]
              }
            } else {
              const newSupportMail = {
                id: supportMailId,
                title: `Consulta de Cajero sobre Orden #${orderId.slice(0, 8)}`,
                sender: senderName || 'Cajero Autorizado',
                date: 'Hoy',
                category: 'support',
                isRead: false,
                content: message.trim(),
                badge: 'Soporte P2P',
                orderId,
                status: 'pending',
                timestamp,
                replies: [replyItem]
              }
              inbox.unshift(newSupportMail)
            }

            await userRef.update({ inbox: inbox.slice(0, 50) })
          }
        }
      } catch (err) {
        console.warn('[OrderMessageAPI] Firestore sync notice:', err)
      }
    }

    return NextResponse.json({
      success: true,
      message: newChatMessage
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
