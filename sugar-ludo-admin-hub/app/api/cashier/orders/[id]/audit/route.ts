import { NextResponse } from 'next/server'
import { verifyStaffAuth } from '@/lib/api-auth-guard'
import { auditWithdrawalOrder } from '@/lib/atomic-transactions'

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await verifyStaffAuth(request, ['cashier', 'admin'])
  if (!authResult.authorized) {
    return authResult.errorResponse!
  }

  try {
    const resolvedParams = await Promise.resolve(params)
    const orderId = resolvedParams.id

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'ID de orden no proporcionado' }, { status: 400 })
    }

    const auditResult = await auditWithdrawalOrder(orderId)

    return NextResponse.json({
      success: true,
      fraudAudit: auditResult
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error durante auditoría de orden'
    console.error(`[API /api/cashier/orders/[id]/audit] Error:`, msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
