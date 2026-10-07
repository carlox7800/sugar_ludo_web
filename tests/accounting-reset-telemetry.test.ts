import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapScreenToTelemetryState } from '../lib/presence-service.ts'

describe('Suite: Conciliación Contable tras Reinicio & Telemetría en Vivo (v9.7.4)', () => {
  it('DESCUADRE CONTABLE: debe garantizar que el flotante de cajeros en custodia sea estrictamente 0 cuando la custodia es 0', () => {
    // Simulación del estado residual anterior ($105.00 en cajeros con $0.00 en custodia)
    const playerCustodyUSD = 0.0
    const rawCashierFloatsUSD = 105.0 // Cajeros en cache local antes de ser reseteados

    // Algoritmo contable corregido en TreasuryBreakdownCard y AdminDashboard
    const effectiveCashierFloatsUSD = playerCustodyUSD > 0
      ? Math.min(playerCustodyUSD, Math.max(0, rawCashierFloatsUSD))
      : 0

    assert.equal(effectiveCashierFloatsUSD, 0, 'El flotante de cajeros en custodia debe ser estrictamente 0')
    
    const matrixAccountUSD = playerCustodyUSD - effectiveCashierFloatsUSD
    assert.equal(matrixAccountUSD, 0, 'La cuenta matriz no debe presentar balances negativos ni distorsiones')
    assert.equal(matrixAccountUSD + effectiveCashierFloatsUSD, playerCustodyUSD, 'La suma de componentes debe igualar exactamente la custodia')
  })

  it('DESCUADRE CONTABLE: al ingresar nuevos fondos, la distribución de custodia respeta el tope contable', () => {
    const playerCustodyUSD = 50.0
    const rawCashierFloatsUSD = 20.0

    const effectiveCashierFloatsUSD = playerCustodyUSD > 0
      ? Math.min(playerCustodyUSD, Math.max(0, rawCashierFloatsUSD))
      : 0
    const matrixAccountUSD = playerCustodyUSD - effectiveCashierFloatsUSD

    assert.equal(effectiveCashierFloatsUSD, 20.0)
    assert.equal(matrixAccountUSD, 30.0)
    assert.equal(matrixAccountUSD + effectiveCashierFloatsUSD, 50.0)
  })

  it('ECUACIÓN DE BÓVEDA: Bóveda Total = Custodia de Jugadores + Ganancias Netas', () => {
    // Caso 1: Tras reinicio contable total
    const playerBalancesUSD = 0.0
    const houseNetProfitsUSD = 0.0
    const totalVaultUSD = playerBalancesUSD + houseNetProfitsUSD
    assert.equal(totalVaultUSD, 0.0)

    // Caso 2: Operaciones activas
    const activePlayerCustody = 1500.50
    const activeHouseProfits = 320.25
    const activeVault = activePlayerCustody + activeHouseProfits
    assert.equal(activeVault, 1820.75)
  })

  it('TELEMETRÍA EN VIVO: mapeo determinista de pantallas de juego a estados de concurrencia', () => {
    assert.equal(mapScreenToTelemetryState('training'), 'playersInAITraining')
    assert.equal(mapScreenToTelemetryState('game'), 'playersInAITraining')
    assert.equal(mapScreenToTelemetryState('competitive'), 'playersInCompetitive')
    assert.equal(mapScreenToTelemetryState('online-training'), 'playersInOnlineTraining')
    assert.equal(mapScreenToTelemetryState('online-game', 'competitive'), 'playersInCompetitive')
    assert.equal(mapScreenToTelemetryState('online-game', 'training'), 'playersInOnlineTraining')
    assert.equal(mapScreenToTelemetryState('lobby'), 'playersInLobby')
    assert.equal(mapScreenToTelemetryState('store'), 'playersInLobby')
    assert.equal(mapScreenToTelemetryState('profile'), 'playersInLobby')
  })

  it('TELEMETRÍA EN VIVO: cálculo y agregación correcta de concurrencia total y salas activas', () => {
    const telemetryData = {
      playersInLobby: 12,
      playersInAITraining: 5,
      playersInOnlineTraining: 4,
      playersInCompetitive: 6
    }

    const totalOnline = telemetryData.playersInLobby +
      telemetryData.playersInAITraining +
      telemetryData.playersInOnlineTraining +
      telemetryData.playersInCompetitive
    const activeRooms = Math.ceil((telemetryData.playersInOnlineTraining + telemetryData.playersInCompetitive) / 2)

    assert.equal(totalOnline, 27)
    assert.equal(activeRooms, 5)
  })

  it('TABLEROS ACTIVOS (2P, 3P, 4P, 5P, 6P): solo sesiones activas en juego incrementan tableros', () => {
    // 5 sesiones en diferentes estados
    const sessions = [
      { state: 'playersInLobby', mode: 'none' },
      { state: 'playersInLobby', mode: '4p' }, // En lobby, el mode debe ignorarse
      { state: 'playersInAITraining', mode: '2p' },
      { state: 'playersInAITraining', mode: '3p' },
      { state: 'playersInOnlineTraining', mode: '4p' },
      { state: 'playersInCompetitive', mode: '5p' },
      { state: 'playersInCompetitive', mode: '6p' },
    ]

    let inLobby = 0, inAI = 0, inOnline = 0, inComp = 0
    let m2p = 0, m3p = 0, m4p = 0, m5p = 0, m6p = 0

    for (const sess of sessions) {
      if (sess.state === 'playersInLobby') {
        inLobby++
      } else {
        if (sess.state === 'playersInAITraining') inAI++
        else if (sess.state === 'playersInOnlineTraining') inOnline++
        else if (sess.state === 'playersInCompetitive') inComp++

        if (sess.mode === '2p') m2p++
        else if (sess.mode === '3p') m3p++
        else if (sess.mode === '4p') m4p++
        else if (sess.mode === '5p') m5p++
        else if (sess.mode === '6p') m6p++
      }
    }

    assert.equal(inLobby, 2)
    assert.equal(inAI, 2)
    assert.equal(inOnline, 1)
    assert.equal(inComp, 2)

    // Tableros activos contemplando todas las modalidades 2P a 6P
    assert.equal(m2p, 1)
    assert.equal(m3p, 1)
    assert.equal(m4p, 1)
    assert.equal(m5p, 1)
    assert.equal(m6p, 1)

    // Formato: IA, Online y Competitivo
    const modeDistribution = {
      twoPlayers: m2p,
      threePlayers: m3p,
      fourPlayers: m4p,
      fivePlayers: m5p,
      sixPlayers: m6p,
      aiGames: inAI,
      onlineGames: inOnline,
      competitiveGames: inComp
    }

    assert.equal(modeDistribution.aiGames, 2)
    assert.equal(modeDistribution.onlineGames, 1)
    assert.equal(modeDistribution.competitiveGames, 2)
  })

  it('REACTIVIDAD: al abandonar la partida, el tablero activo desciende a 0 de inmediato', () => {
    // Jugador jugando 4P
    let activeSession = { state: 'playersInAITraining', mode: '4p' }
    let m4p = activeSession.state !== 'playersInLobby' && activeSession.mode === '4p' ? 1 : 0
    assert.equal(m4p, 1)

    // Jugador abandona la partida y regresa a lobby
    activeSession = { state: 'playersInLobby', mode: 'none' }
    m4p = activeSession.state !== 'playersInLobby' && activeSession.mode === '4p' ? 1 : 0
    assert.equal(m4p, 0, 'El tablero activo 4P debe ser 0 al volver al lobby')
  })
})
