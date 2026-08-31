import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { OrderChatMessage } from '@/types/cashier'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'cashier_orders.json')
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sweety-ludo-87343'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const body = await request.json()
    const { message, senderName, senderUid, senderRole, attachmentUrl, playerUid: passedPlayerUid } = body

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

    let playerUid = passedPlayerUid || ''
    let orderData: any = null

    // 1. Resolver playerUid desde disco local
    try {
      if (!playerUid && fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8')
        const orders = JSON.parse(raw || '[]')
        orderData = orders.find((o: any) => o.id === orderId)
        if (orderData?.playerUid) {
          playerUid = orderData.playerUid
        }
      }
    } catch {}

    // 2. Si aún no tenemos playerUid, intentar obtenerlo de Firestore REST API
    if (!playerUid) {
      try {
        const getDocUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/cashier_orders/${orderId}`
        const res = await fetch(getDocUrl)
        if (res.ok) {
          const docJson = await res.json()
          playerUid = docJson.fields?.playerUid?.stringValue || ''
        }
      } catch {}
    }

    // 3. Escribir mensaje en subcolección cashier_orders/{orderId}/messages via Firestore REST
    try {
      const postMsgUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/cashier_orders/${orderId}/messages?documentId=${msgId}`
      fetch(postMsgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            id: { stringValue: msgId },
            orderId: { stringValue: orderId },
            senderUid: { stringValue: senderUid || 'csh_primary' },
            senderName: { stringValue: senderName || 'Cajero' },
            senderRole: { stringValue: senderRole || 'cashier' },
            message: { stringValue: message.trim() },
            timestamp: { integerValue: String(timestamp) },
            isRead: { booleanValue: false },
            ...(attachmentUrl ? { attachmentUrl: { stringValue: attachmentUrl } } : {})
          }
        })
      }).catch((e) => console.warn('[MessageAPI] Error posting message to Firestore REST:', e))
    } catch {}

    // 4. Intentar con adminDb si está disponible
    if (adminDb && adminDb.collection) {
      try {
        await adminDb.collection('cashier_orders').doc(orderId).collection('messages').doc(msgId).set(newChatMessage)
      } catch {}
    }

    // 5. Inyectar/actualizar correo en el inbox del jugador via Firestore REST y adminDb
    if (playerUid) {
      const replyItem: any = {
        id: msgId,
        sender: senderName || 'Cajero',
        senderRole: 'cashier',
        message: message.trim(),
        timestamp,
      }
      if (attachmentUrl) {
        replyItem.attachmentUrl = attachmentUrl
      }

      // Vía adminDb (prioridad 1)
      let inboxUpdated = false
      if (adminDb && adminDb.collection) {
        try {
          const userRef = adminDb.collection('users').doc(playerUid)
          const userDoc = await userRef.get()
          if (userDoc.exists) {
            const userData = userDoc.data() || {}
            const inbox = Array.isArray(userData.inbox) ? userData.inbox : []
            const supportMailId = `mail_sup_${orderId}`
            const existingMailIndex = inbox.findIndex((m: any) => m.id === supportMailId || m.orderId === orderId)

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
              const newSupportMail: any = {
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
              if (attachmentUrl) {
                newSupportMail.attachmentUrl = attachmentUrl
              }
              inbox.unshift(newSupportMail)
            }
            await userRef.update({ inbox: inbox.slice(0, 50) })
            inboxUpdated = true
          }
        } catch (dbErr) {
          console.warn('[MessageAPI] adminDb inbox update notice:', dbErr)
        }
      }

      // Vía REST API get/patch (fallback únicamente si adminDb no estuvo disponible o falló)
      if (!inboxUpdated) {
        try {
          const userDocUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${playerUid}`
          const userDocRes = await fetch(userDocUrl)
          if (userDocRes.ok) {
            const uDoc = await userDocRes.json()
            const currentInboxValues = uDoc.fields?.inbox?.arrayValue?.values || []
            
            const newSupportMailRest = {
              mapValue: {
                fields: {
                  id: { stringValue: `mail_sup_${orderId}` },
                  title: { stringValue: `Consulta de Cajero sobre Orden #${orderId.slice(0, 8)}` },
                  sender: { stringValue: senderName || 'Cajero Autorizado' },
                  date: { stringValue: 'Hoy' },
                  category: { stringValue: 'support' },
                  isRead: { booleanValue: false },
                  content: { stringValue: message.trim() },
                  badge: { stringValue: 'Soporte P2P' },
                  orderId: { stringValue: orderId },
                  status: { stringValue: 'pending' },
                  timestamp: { integerValue: String(timestamp) }
                }
              }
            }

            // Prepend new or updated mail, filtrando cualquier correo previo con el mismo orderId
            const updatedInbox = [newSupportMailRest, ...currentInboxValues.filter((v: any) => v.mapValue?.fields?.orderId?.stringValue !== orderId)].slice(0, 50)

            await fetch(`${userDocUrl}?updateMask.fieldPaths=inbox`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  inbox: {
                    arrayValue: {
                      values: updatedInbox
                    }
                  }
                }
              })
            })
          }
        } catch (restErr) {
          console.warn('[MessageAPI] REST inbox patch notice:', restErr)
        }
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
