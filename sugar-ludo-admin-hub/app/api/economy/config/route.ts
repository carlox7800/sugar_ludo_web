import { NextResponse } from 'next/server'

// In-Memory state with fallback
let globalEconomyConfig = {
  items: null as any,
  competitiveMatrix: null as any,
  packages: null as any,
  tournaments: null as any,
  seasonRanking: null as any,
  goldRushMultiplier: 2.0,
  doubleXpActive: false,
  tournamentBonusPct: 10,
  normalFee: 5.0,
  vipFee: 10.0,
  updatedAt: Date.now()
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      config: globalEconomyConfig,
      updatedAt: globalEconomyConfig.updatedAt
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    globalEconomyConfig = {
      ...globalEconomyConfig,
      ...body,
      updatedAt: Date.now()
    }

    return NextResponse.json({
      success: true,
      message: 'Configuración económica sincronizada en tiempo real para todo el ecosistema.',
      config: globalEconomyConfig
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
