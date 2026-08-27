import { NextResponse } from 'next/server'
import { MOCK_ORDERS } from '../../../../lib/mock-data'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    let filtered = [...MOCK_ORDERS]
    if (status && status !== 'all') {
      filtered = filtered.filter(o => o.status === status)
    }
    if (type && type !== 'all') {
      filtered = filtered.filter(o => o.type === type)
    }

    return NextResponse.json({
      success: true,
      orders: filtered,
      totalCount: filtered.length
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
