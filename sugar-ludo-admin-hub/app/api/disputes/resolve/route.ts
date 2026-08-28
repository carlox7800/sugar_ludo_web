import { NextResponse } from 'next/server'
import { resolveDisputeCaseAtomics } from '@/lib/atomic-transactions'

export async function POST(request: Request) {
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
