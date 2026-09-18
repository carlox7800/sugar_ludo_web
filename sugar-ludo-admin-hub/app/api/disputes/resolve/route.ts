import { NextResponse } from 'next/server'
import { resolveDisputeCaseAtomics } from '@/lib/atomic-transactions'
import { verifyStaffAuth } from '@/lib/api-auth-guard'

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

export async function POST(request: Request) {
  const authResult = await verifyStaffAuth(request, ['admin'])
  if (!authResult.authorized) {
    return authResult.errorResponse!
  }

  try {
    const body = await request.json()
    const { disputeId, verdict, adminUid, adminName, resolutionNotes } = body

    if (!disputeId || !verdict) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros requeridos (disputeId, verdict)' },
        { status: 400 }
      )
    }

    const result = await resolveDisputeCaseAtomics({
      disputeId,
      verdict,
      adminUid: adminUid || 'super_admin_01',
      adminName: adminName || 'Super Admin',
      resolutionNotes
    })

    return NextResponse.json({ success: true, message: result.message })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
