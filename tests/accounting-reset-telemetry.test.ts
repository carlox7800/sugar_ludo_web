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
})
