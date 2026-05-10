// verify_store.mjs
// Minerva Store — Math Verification
// Run: node verify_store.mjs
// Tests all store logic in isolation. Zero UI dependencies.

// ─── Inline the pure functions (copy from store.js for isolation) ─────────────

const FX = {
  USD_AED: 3.6725, INR_AED: 0.04275, SGD_AED: 2.73,
  AED_USD: 0.2723, AED_INR: 23.39,
}

function toAED(amount, currency, fx) {
  if (!amount || isNaN(amount)) return 0
  if (currency === 'AED') return amount
  if (currency === 'USD') return amount * fx.USD_AED
  if (currency === 'INR') return amount * fx.INR_AED
  if (currency === 'SGD') return amount * fx.SGD_AED
  return amount
}

function fromAED(amountAED, targetCurrency, fx) {
  if (targetCurrency === 'AED') return amountAED
  if (targetCurrency === 'USD') return amountAED * fx.AED_USD
  if (targetCurrency === 'INR') return amountAED * fx.AED_INR
  return amountAED
}

const LIQUID_TYPES = new Set(['current', 'savings'])

function computeLiveBalance(account, transactions) {
  const base = account.reconciledBalance ?? 0
  const drift = transactions
    .filter(t =>
      t.accountId === account.id &&
      t.status !== 'reconciled' &&
      (!account.reconciledAt || t.date >= account.reconciledAt)
    )
    .reduce((sum, t) => sum + (t.amount ?? 0), 0)
  return base + drift
}

function computeLiveLiquidity(accounts, transactions, fx) {
  return accounts
    .filter(a => a.active && LIQUID_TYPES.has(a.type))
    .reduce((total, a) => total + toAED(computeLiveBalance(a, transactions), a.currency, fx), 0)
}

function computeNetWorth(assets, liabilities, accounts, transactions, fx) {
  const totalAssets = assets.reduce((s, a) => s + (a.valuationAED ?? 0), 0)
  const structuredLiabs = liabilities.reduce((s, l) => s + toAED(l.outstandingBalance ?? 0, l.currency, fx), 0)
  const cardLiabs = accounts
    .filter(a => a.active && a.type === 'credit_card')
    .reduce((s, a) => s + toAED(Math.max(0, computeLiveBalance(a, transactions)), a.currency, fx), 0)
  return totalAssets - structuredLiabs - cardLiabs
}

// ─── TEST HARNESS ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0, total = 0

function test(name, actual, expected, tolerance = 0.01) {
  total++
  const diff = Math.abs(actual - expected)
  const ok   = diff <= tolerance
  const icon = ok ? '✅' : '❌'
  const status = ok ? 'PASS' : 'FAIL'
  console.log(`  ${icon} ${name}`)
  if (!ok) {
    console.log(`       Expected: ${expected}`)
    console.log(`       Got:      ${actual}`)
    console.log(`       Diff:     ${diff.toFixed(4)}`)
    failed++
  } else {
    passed++
  }
}

function section(name) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${name}`)
  console.log('─'.repeat(60))
}

// ─── TEST DATA ────────────────────────────────────────────────────────────────

const ACCOUNTS = [
  // Liquid AED accounts
  { id: 'adcb-aed',   type: 'current', currency: 'AED', active: true, reconciledBalance: 50000, reconciledAt: '2026-04-30', owner: 'Kedar',  country: 'UAE'   },
  { id: 'wio-aed',    type: 'current', currency: 'AED', active: true, reconciledBalance: 12000, reconciledAt: '2026-04-30', owner: 'Kedar',  country: 'UAE'   },
  // Liquid USD account
  { id: 'chase-usd',  type: 'current', currency: 'USD', active: true, reconciledBalance: 5000,  reconciledAt: '2026-04-30', owner: 'Kedar',  country: 'USA'   },
  // Liquid INR account
  { id: 'axis-inr',   type: 'current', currency: 'INR', active: true, reconciledBalance: 100000,reconciledAt: '2026-04-30', owner: 'Kedar',  country: 'India' },
  // Credit card (liability — NOT liquid)
  { id: 'enbd-cc',    type: 'credit_card', currency: 'AED', active: true, reconciledBalance: 3500, reconciledAt: '2026-04-30', owner: 'Kedar', country: 'UAE' },
  // Investment (NOT liquid — not current/savings)
  { id: 'ibkr-usd',   type: 'investment',  currency: 'USD', active: true, reconciledBalance: 70000,reconciledAt: '2026-04-29', owner: 'Kedar', country: 'UAE' },
]

const ASSETS = [
  { id: 'villa',     valuationAED: 8923000 },
  { id: 'portfolio', valuationAED: 1287883 },
  { id: 'fcnr',      valuationAED: 918125  },
]

const LIABILITIES = [
  { id: 'adcb-mortgage', currency: 'AED', outstandingBalance: 4780000 },
  { id: 'fcnr-loan',     currency: 'USD', outstandingBalance: 2250000 },
]

// ─── SECTION 1: FX CONVERSION ─────────────────────────────────────────────────

section('1. FX Conversion Math')

test('AED → AED (identity)',     toAED(100, 'AED', FX),  100)
test('USD → AED (5000 USD)',     toAED(5000, 'USD', FX), 5000 * 3.6725)
test('INR → AED (100000 INR)',   toAED(100000, 'INR', FX), 100000 * 0.04275)
test('AED → USD (3672.5 AED)',   fromAED(3672.5, 'USD', FX), 3672.5 * 0.2723, 0.1)

// ─── SECTION 2: LIVE BALANCE ─────────────────────────────────────────────────

section('2. Live Balance Computation')

test('Account with no transactions = reconciledBalance',
  computeLiveBalance(ACCOUNTS[0], []),
  50000
)

test('Account + one expense transaction',
  computeLiveBalance(ACCOUNTS[0], [
    { id: 't1', accountId: 'adcb-aed', amount: -2000, date: '2026-05-01', status: 'pending' }
  ]),
  48000
)

test('Account + income transaction',
  computeLiveBalance(ACCOUNTS[0], [
    { id: 't2', accountId: 'adcb-aed', amount: 95300, date: '2026-05-01', status: 'pending' }
  ]),
  145300
)

test('Reconciled transactions are excluded from drift',
  computeLiveBalance(ACCOUNTS[0], [
    { id: 't3', accountId: 'adcb-aed', amount: -5000, date: '2026-04-15', status: 'reconciled' },
    { id: 't4', accountId: 'adcb-aed', amount: -2000, date: '2026-05-01', status: 'pending' }
  ]),
  48000   // only the pending -2000 adds to drift; the reconciled -5000 is baked into reconciledBalance
)

test('Transactions before reconciledAt are excluded',
  computeLiveBalance(ACCOUNTS[0], [
    // date is before reconciledAt ('2026-04-30'), so should NOT drift
    { id: 't5', accountId: 'adcb-aed', amount: -1000, date: '2026-04-29', status: 'pending' }
  ]),
  50000
)

test('Transactions on different account do not affect this balance',
  computeLiveBalance(ACCOUNTS[0], [
    { id: 't6', accountId: 'wio-aed', amount: -5000, date: '2026-05-01', status: 'pending' }
  ]),
  50000
)

test('Multiple transactions accumulate correctly',
  computeLiveBalance(ACCOUNTS[0], [
    { id: 't7',  accountId: 'adcb-aed', amount: 95300,  date: '2026-05-01', status: 'pending' }, // salary
    { id: 't8',  accountId: 'adcb-aed', amount: -26372, date: '2026-05-01', status: 'pending' }, // mortgage
    { id: 't9',  accountId: 'adcb-aed', amount: -850,   date: '2026-05-03', status: 'pending' }, // carrefour
    { id: 't10', accountId: 'adcb-aed', amount: -1200,  date: '2026-05-04', status: 'pending' }, // dining
  ]),
  50000 + 95300 - 26372 - 850 - 1200   // = 116878
)

// ─── SECTION 3: LIVE LIQUIDITY ────────────────────────────────────────────────

section('3. Live Liquidity (only current + savings accounts, in AED)')

// Expected baseline with no transactions:
// adcb-aed:  50000 AED  → 50000 AED
// wio-aed:   12000 AED  → 12000 AED
// chase-usd:  5000 USD  →  5000 × 3.6725 = 18362.50 AED
// axis-inr: 100000 INR  → 100000 × 0.04275 = 4275 AED
// enbd-cc (credit card): EXCLUDED
// ibkr-usd (investment): EXCLUDED
const expectedBaseline = 50000 + 12000 + (5000 * 3.6725) + (100000 * 0.04275)

test('Baseline liquidity (no transactions)',
  computeLiveLiquidity(ACCOUNTS, [], FX),
  expectedBaseline, 0.1
)

test('Liquidity updates when expense logged on current account',
  computeLiveLiquidity(ACCOUNTS, [
    { id: 'x1', accountId: 'adcb-aed', amount: -1000, date: '2026-05-01', status: 'pending' }
  ], FX),
  expectedBaseline - 1000, 0.1
)

test('Credit card spend does NOT affect liquidity (CC is excluded)',
  computeLiveLiquidity(ACCOUNTS, [
    { id: 'x2', accountId: 'enbd-cc', amount: 500, date: '2026-05-01', status: 'pending' }
  ], FX),
  expectedBaseline, 0.1  // unchanged
)

test('Investment account activity does NOT affect liquidity',
  computeLiveLiquidity(ACCOUNTS, [
    { id: 'x3', accountId: 'ibkr-usd', amount: -10000, date: '2026-05-01', status: 'pending' }
  ], FX),
  expectedBaseline, 0.1  // unchanged
)

test('USD expense reduces liquidity in AED equivalent',
  computeLiveLiquidity(ACCOUNTS, [
    { id: 'x4', accountId: 'chase-usd', amount: -200, date: '2026-05-01', status: 'pending' }
  ], FX),
  expectedBaseline - (200 * 3.6725), 0.1  // -735 AED equivalent
)

// ─── SECTION 4: DRIFT CALCULATION ────────────────────────────────────────────

section('4. Reconciliation Drift Math')

function simulateDrift(account, transactions, actualBalance) {
  const tracked = computeLiveBalance(account, transactions)
  const drift   = actualBalance - tracked
  return { tracked, drift, adjustmentNeeded: Math.abs(drift) > 0.001 }
}

const testAccount = ACCOUNTS[0]  // adcb-aed, recon=50000
const testTxns = [
  { id: 'r1', accountId: 'adcb-aed', amount: 95300,  date: '2026-05-01', status: 'pending' },
  { id: 'r2', accountId: 'adcb-aed', amount: -26372, date: '2026-05-01', status: 'pending' },
  { id: 'r3', accountId: 'adcb-aed', amount: -850,   date: '2026-05-03', status: 'pending' },
]
// tracked = 50000 + 95300 - 26372 - 850 = 118078

test('Tracked balance before reconciliation',
  computeLiveBalance(testAccount, testTxns),
  118078
)

test('Zero drift (perfect reconciliation)',
  simulateDrift(testAccount, testTxns, 118078).drift,
  0
)

test('Positive drift (bank has more than we tracked — missed income)',
  simulateDrift(testAccount, testTxns, 119078).drift,
  1000
)

test('Negative drift (bank has less — unlogged expense or bank charge)',
  simulateDrift(testAccount, testTxns, 117578).drift,
  -500
)

test('Drift triggers adjustment flag',
  simulateDrift(testAccount, testTxns, 119078).adjustmentNeeded,
  1  // truthy
)

test('Zero drift suppresses adjustment',
  simulateDrift(testAccount, testTxns, 118078).adjustmentNeeded ? 1 : 0,
  0
)

// ─── SECTION 5: NET WORTH ─────────────────────────────────────────────────────

section('5. Net Worth Math')

// Assets:
//   villa:     8,923,000 AED
//   portfolio: 1,287,883 AED
//   fcnr:        918,125 AED
//   total:    11,129,008 AED

// Liabilities:
//   adcb-mortgage: 4,780,000 AED
//   fcnr-loan:     2,250,000 USD × 3.6725 = 8,263,125 AED
//   total:        13,043,125 AED

// CC (enbd-cc): reconciledBalance = 3500 AED (owed) = 3500 AED liability

const expectedAssets = 8923000 + 1287883 + 918125
const expectedLiabsStructured = 4780000 + (2250000 * 3.6725)
const expectedCCLiab = 3500
const expectedNW = expectedAssets - expectedLiabsStructured - expectedCCLiab

test('Total assets AED',
  ASSETS.reduce((s, a) => s + a.valuationAED, 0),
  expectedAssets
)

test('Structured liabilities AED',
  LIABILITIES.reduce((s, l) => s + toAED(l.outstandingBalance, l.currency, FX), 0),
  expectedLiabsStructured, 1
)

test('Net worth (no transactions)',
  computeNetWorth(ASSETS, LIABILITIES, ACCOUNTS, [], FX),
  expectedNW, 1
)

test('Net worth decreases when liability increases',
  computeNetWorth(
    ASSETS,
    [{ id: 'adcb-mortgage', currency: 'AED', outstandingBalance: 4880000 }, ...LIABILITIES.slice(1)],
    ACCOUNTS, [], FX
  ),
  expectedNW - 100000, 1
)

test('Net worth increases when asset valuation increases',
  computeNetWorth(
    [{ id: 'villa', valuationAED: 9423000 }, ...ASSETS.slice(1)],
    LIABILITIES, ACCOUNTS, [], FX
  ),
  expectedNW + 500000, 1
)

test('CC spend increases debt → decreases net worth',
  computeNetWorth(ASSETS, LIABILITIES, ACCOUNTS, [
    { id: 'cc1', accountId: 'enbd-cc', amount: 1000, date: '2026-05-01', status: 'pending' }
  ], FX),
  expectedNW - 1000, 1
)

// ─── SECTION 6: SIGN CONVENTION ──────────────────────────────────────────────

section('6. Sign Convention Verification')

function getSignedAmount(accountType, txnType, amount) {
  const abs = Math.abs(amount)
  if (accountType === 'credit_card') {
    return txnType === 'income' ? -abs : abs   // payment reduces debt
  }
  return txnType === 'income' ? abs : -abs
}

test('Current account — income is positive',  getSignedAmount('current', 'income', 1000),  1000)
test('Current account — expense is negative', getSignedAmount('current', 'expense', 500), -500)
test('CC — spend increases debt (positive)',  getSignedAmount('credit_card', 'expense', 300), 300)
test('CC — payment reduces debt (negative)', getSignedAmount('credit_card', 'income', 300), -300)

// ─── SUMMARY ──────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`)
console.log(`  MINERVA STORE — VERIFICATION RESULTS`)
console.log('═'.repeat(60))
console.log(`  Total:  ${total}`)
console.log(`  Passed: ${passed}  ✅`)
console.log(`  Failed: ${failed}  ${failed > 0 ? '❌' : ''}`)
console.log('═'.repeat(60))

if (failed > 0) {
  console.log('\n  ⚠️  Fix failing tests before building UI.\n')
  process.exit(1)
} else {
  console.log('\n  Brain verified. Math is clean. Build the surface. 🧠\n')
  process.exit(0)
}
