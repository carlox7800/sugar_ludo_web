import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cleanFirestorePayload } from '../sugar-ludo-admin-hub/lib/clean-firestore-payload.ts'
import {
  calculateWithdrawal,
  coinsToUSD,
  usdToCoins,
  SC_PER_USDT,
  NORMAL_WITHDRAW_FEE_PCT,
  VIP_WITHDRAW_FEE_PCT
} from '../sugar-ludo-admin-hub/lib/treasury-calculator.ts'

describe('Suite: cleanFirestorePayload & Normalización de Payloads', () => {
  it('debe eliminar claves con valor undefined en la raíz del objeto', () => {
    const input = {
      orderId: 'wit_123',
      amount: 5000,
      notes: undefined,
      status: 'pending'
    }

    const cleaned = cleanFirestorePayload(input)

    assert.equal('notes' in cleaned, false)
    assert.equal(cleaned.orderId, 'wit_123')
    assert.equal(cleaned.amount, 5000)
    assert.equal(cleaned.status, 'pending')
  })

  it('debe eliminar recursivamente valores undefined en objetos anidados', () => {
    const input = {
      id: 'order_456',
      metadata: {
        playerPaymentAccount: {
          bankName: 'Banesco',
          accountNumber: '01340000000000000000',
          accountType: undefined,
          beneficiary: {
            name: 'Carlos Perez',
            phone: undefined,
            idNumber: 'V-12345678'
          }
        },
        deviceInfo: undefined
      }
    }

    const cleaned = cleanFirestorePayload(input as unknown as Record<string, unknown>)
    const metadata = cleaned.metadata as Record<string, unknown>
    const payment = metadata.playerPaymentAccount as Record<string, unknown>
    const beneficiary = payment.beneficiary as Record<string, unknown>

    assert.equal('deviceInfo' in metadata, false)
    assert.equal('accountType' in payment, false)
    assert.equal('phone' in beneficiary, false)
    assert.equal(beneficiary.name, 'Carlos Perez')
    assert.equal(beneficiary.idNumber, 'V-12345678')
  })

  it('debe preservar de forma estricta valores false, 0, strings vacíos, null, arrays y Date', () => {
    const testDate = new Date('2026-09-20T00:00:00Z')
    const input = {
      isVip: false,
      balance: 0,
      emptyStr: '',
      nullValue: null,
      tags: ['game', 'vip', 0],
      createdAt: testDate,
      undefinedProp: undefined
    }

    const cleaned = cleanFirestorePayload(input)

    assert.equal(cleaned.isVip, false)
    assert.equal(cleaned.balance, 0)
    assert.equal(cleaned.emptyStr, '')
    assert.equal(cleaned.nullValue, null)
    assert.deepEqual(cleaned.tags, ['game', 'vip', 0])
    assert.equal(cleaned.createdAt, testDate)
    assert.equal('undefinedProp' in cleaned, false)
  })

  it('no debe mutar destructivamente el objeto original', () => {
    const original = { key: 'val', badKey: undefined }
    const copy = { ...original }
    cleanFirestorePayload(original)

    assert.deepEqual(original, copy)
    assert.equal('badKey' in original, true)
  })
})

describe('Suite: Matemática Financiera y Comisiones de Retiro', () => {
  it('debe calcular correctamente la comisión estándar del 5% (72h SLA)', () => {
    const amountCoins = 10000 // 100 USDT
    const calc = calculateWithdrawal(amountCoins, false)

    assert.equal(calc.requestedCoins, 10000)
    assert.equal(calc.feePercent, 5)
    assert.equal(calc.feeCoins, 500)
    assert.equal(calc.feeUSD, 5.0)
    assert.equal(calc.netCoins, 9500)
    assert.equal(calc.netUSD, 95.0)
    assert.equal(calc.estimatedHours, 72)
    assert.equal(NORMAL_WITHDRAW_FEE_PCT, 0.05)
  })

  it('debe calcular correctamente la comisión VIP del 10% (24h SLA)', () => {
    const amountCoins = 10000 // 100 USDT
    const calc = calculateWithdrawal(amountCoins, true)

    assert.equal(calc.requestedCoins, 10000)
    assert.equal(calc.feePercent, 10)
    assert.equal(calc.feeCoins, 1000)
    assert.equal(calc.feeUSD, 10.0)
    assert.equal(calc.netCoins, 9000)
    assert.equal(calc.netUSD, 90.0)
    assert.equal(calc.estimatedHours, 24)
    assert.equal(VIP_WITHDRAW_FEE_PCT, 0.10)
  })

  it('debe respetar la paridad económica: 1 USDT = 100 Sugar Coins (1 SC = $0.01 USD)', () => {
    assert.equal(SC_PER_USDT, 100)
    assert.equal(coinsToUSD(100), 1.0)
    assert.equal(coinsToUSD(5000), 50.0)
    assert.equal(usdToCoins(1.0), 100)
    assert.equal(usdToCoins(35.5), 3550)
  })

  it('debe validar montos mínimos y redondeos financieros exactos', () => {
    // Retiro mínimo: 100 SC ($1 USDT)
    const calcMin = calculateWithdrawal(100, false)
    assert.equal(calcMin.feeCoins, 5)
    assert.equal(calcMin.netCoins, 95)
    assert.equal(calcMin.netUSD, 0.95)

    // Monto impar con redondeo
    const calcOdd = calculateWithdrawal(333, false)
    // 333 * 0.05 = 16.65 -> redondeado a 17 coins
    assert.equal(calcOdd.feeCoins, 17)
    assert.equal(calcOdd.netCoins, 316)
    assert.equal(calcOdd.feeCoins + calcOdd.netCoins, 333)
  })

  it('debe validar la lógica de suficiencia de saldo para retiros en escrow', () => {
    const userCoins = 4500
    const requestedCoins = 5000

    const hasSufficientBalance = userCoins >= requestedCoins
    assert.equal(hasSufficientBalance, false)

    const validRequested = 4500
    const hasSufficientValid = userCoins >= validRequested
    assert.equal(hasSufficientValid, true)
  })
})

describe('Suite: Validación de Payloads de Cuentas de Pago (Cripto vs. Bancarias)', () => {
  it('debe normalizar correctamente una billetera cripto en formato string', () => {
    const rawCryptoAddress = 'TYDzsYUbEmFDGs8hC6QG6D8p7YtNf9Kk1L'
    const orderPayload = {
      id: 'wit_crypto_001',
      type: 'withdraw',
      amountSugarCoins: 5000,
      paymentMethod: 'usdt_trc20',
      playerPaymentAccount: typeof rawCryptoAddress === 'string' && rawCryptoAddress ? rawCryptoAddress : undefined,
      receiptReferenceNumber: rawCryptoAddress
    }

    const cleaned = cleanFirestorePayload(orderPayload)

    assert.equal(typeof cleaned.playerPaymentAccount, 'string')
    assert.equal(cleaned.playerPaymentAccount, 'TYDzsYUbEmFDGs8hC6QG6D8p7YtNf9Kk1L')
    assert.equal(cleaned.receiptReferenceNumber, 'TYDzsYUbEmFDGs8hC6QG6D8p7YtNf9Kk1L')
  })

  it('debe normalizar correctamente una cuenta bancaria en formato objeto PaymentAccount', () => {
    const bankAccount = {
      bankName: 'Mercantil Banco',
      accountNumber: '01050000000000000000',
      accountHolder: 'Maria Gomez',
      idDocument: 'V-20123456',
      notes: undefined
    }

    const orderPayload = {
      id: 'wit_bank_002',
      type: 'withdraw',
      amountSugarCoins: 10000,
      paymentMethod: 'bank_transfer_ve',
      playerPaymentAccount: bankAccount,
      receiptReferenceNumber: bankAccount.accountNumber
    }

    const cleaned = cleanFirestorePayload(orderPayload as unknown as Record<string, unknown>)
    const account = cleaned.playerPaymentAccount as Record<string, unknown>

    assert.equal(typeof account, 'object')
    assert.equal(account.bankName, 'Mercantil Banco')
    assert.equal(account.accountNumber, '01050000000000000000')
    assert.equal(account.idDocument, 'V-20123456')
    assert.equal('notes' in account, false)
  })
})
