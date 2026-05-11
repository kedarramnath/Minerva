// src/modules/Dashboard/index.jsx
// Minerva Dashboard — Command Centre
//
// CONSTRAINTS HONOURED:
//   • Zero local state for financial data — everything from Zustand selectors
//   • Single scrollable view — no tabs, no sidebars
//   • Only critical metrics — liveLiquidity, netWorth, per-account balances,
//     burn rates, recent transactions, FCNR countdown
//   • Minerva palette tokens only
//   • Negative space as a design element

import { useState }        from 'react'
import { useMinervaStore } from '../../state/store.js'
import { CurrencyToggle }  from '../../components/shared/CurrencyToggle.jsx'
import { fmt }             from '../../utils/currency.js'
import { CATEGORY_META, COUNTRY_FLAGS } from '../../theme.js'
import { OwnerFilter }          from '../../components/shared/OwnerFilter.jsx'
import { SurplusProjection }     from '../../components/shared/SurplusProjection.jsx'
import { SurplusEngine }         from '../../components/shared/SurplusEngine.jsx'
import { CapitalAllocation }     from '../../components/shared/CapitalAllocation.jsx'
import { BurnRateChart }         from '../../components/charts/BurnRateChart.jsx'
import { TransactionSearch }     from '../../components/shared/TransactionSearch.jsx'

// ─── Sub-components (no local financial state) ────────────────────────────────

/** Activity hero: liquid cash figure (rendered inside shared header) */
function ActivityHero() {
  const liveLiquidity    = useMinervaStore(s => s.liveLiquidity)
  const netWorth         = useMinervaStore(s => s.netWorth)
  const activeCurrency   = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay  = useMinervaStore(s => s.selectInDisplayCurrency)

  const liquid = selectInDisplay(liveLiquidity)
  const nw     = selectInDisplay(netWorth)

  return (
    <>
      <p className="text-[38px] font-bold text-white leading-none tracking-tight tabular-nums">
        {fmt(liquid, activeCurrency, { compact: false })}
      </p>
      <div className="flex items-baseline gap-2 mt-2">
        <p className="text-[11px] font-mono text-white/40 uppercase tracking-widest">Net Worth</p>
        <p className={`text-sm font-mono font-semibold tabular-nums ${nw >= 0 ? 'text-sage-lt' : 'text-rose-lt'}`}>
          {fmt(nw, activeCurrency, { compact: true })}
        </p>
      </div>
    </>
  )
}

/** FCNR countdown — one line, high signal */
function FCNRBanner() {
  const days           = useMinervaStore(s => s.selectFCNRDaysRemaining())
  const activeCurrency = useMinervaStore(s => s.activeCurrency)

  // Net proceeds in display currency
  const netUSD = 318611
  const fx     = useMinervaStore(s => s.fx)
  const net    = activeCurrency === 'USD' ? netUSD
               : activeCurrency === 'INR' ? netUSD * fx.USD_AED * (1 / fx.INR_AED)
               : netUSD * fx.USD_AED

  return (
    <div className="mx-5 mt-4 rounded-2xl bg-teal/10 border border-teal/20 px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-mono text-teal uppercase tracking-widest">
          FCNR Maturity
        </p>
        <p className="text-sm font-semibold text-navy mt-0.5">
          {fmt(net, activeCurrency, { compact: true })} arriving 28 Aug 2026
        </p>
      </div>
      <div className="text-right flex-shrink-0 ml-4">
        <p className="text-2xl font-bold font-mono text-teal tabular-nums">{days}</p>
        <p className="text-[10px] font-mono text-muted">days</p>
      </div>
    </div>
  )
}

/** Cash by country — reconciled base + live drift per liquid account */
const COUNTRY_ORDER = ['UAE', 'India', 'USA', 'Singapore']

function CashByCountry() {
  const ownerFilter       = useMinervaStore(s => s.ownerFilter)
  const _allAccounts      = useMinervaStore(s => s.accounts)
  const accounts          = (!ownerFilter || ownerFilter === 'all')
    ? _allAccounts
    : ownerFilter === 'Family'
      ? _allAccounts.filter(a => a.owner === 'Family')
      : _allAccounts.filter(a => a.owner === ownerFilter || a.owner === 'Family')
  const activeCurrency    = useMinervaStore(s => s.activeCurrency)
  const selectLiveBalance = useMinervaStore(s => s.selectLiveBalance)
  const selectInDisplay   = useMinervaStore(s => s.selectInDisplayCurrency)
  const fx                = useMinervaStore(s => s.fx)

  // Group liquid accounts by country
  const grouped = accounts
    .filter(a => a.active && ['current', 'savings'].includes(a.type))
    .reduce((g, a) => {
      if (!g[a.country]) g[a.country] = []
      g[a.country].push(a)
      return g
    }, {})

  const toAED = (amount, currency) => {
    if (currency === 'AED') return amount
    if (currency === 'USD') return amount * fx.USD_AED
    if (currency === 'INR') return amount * fx.INR_AED
    if (currency === 'SGD') return amount * fx.SGD_AED
    return amount
  }

  const liquidAccounts = accounts.filter(a => a.active && ['current', 'savings'].includes(a.type))
  const ownerLabel = ownerFilter === 'all' ? '' : ownerFilter === 'Family' ? 'Family · ' : `${ownerFilter} · `

  return (
    <div className="px-5 mt-6">
      <p className="text-[11px] font-mono text-muted uppercase tracking-widest mb-3">
        {ownerLabel}Cash by Country
      </p>
      {liquidAccounts.length === 0 && (
        <div className="bg-surface rounded-2xl border border-border px-4 py-6 text-center">
          <p className="text-xs text-muted">No liquid accounts for this filter.</p>
        </div>
      )}
      <div className="space-y-2">
        {COUNTRY_ORDER.map(country => {
          const accts = grouped[country]
          if (!accts?.length) return null

          const totalAED = accts.reduce((sum, a) => {
            return sum + toAED(selectLiveBalance(a.id), a.currency)
          }, 0)
          const display = selectInDisplay(totalAED)

          return (
            <div key={country} className="bg-surface rounded-2xl border border-border overflow-hidden">
              {/* Country header row */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="text-base leading-none">{COUNTRY_FLAGS[country]}</span>
                  <span className="text-sm font-semibold text-navy">{country}</span>
                </div>
                <span className="text-sm font-mono font-semibold text-slate tabular-nums">
                  {fmt(display, activeCurrency)}
                </span>
              </div>

              {/* Per-account rows */}
              {accts.map((acct, i) => {
                const bal      = selectLiveBalance(acct.id)
                const balDisp  = selectInDisplay(toAED(bal, acct.currency))
                const isNeg    = bal < 0
                const isPending = acct.reconciledBalance === 0 && !acct.reconciledDate

                return (
                  <div
                    key={acct.id}
                    className={`flex items-center justify-between px-4 py-2.5 ${i < accts.length - 1 ? 'border-b border-border/40' : ''}`}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Reconciled indicator dot */}
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        acct.reconciledDate ? 'bg-sage' : 'bg-amber'
                      }`} />
                      <span className="text-xs text-slate">{acct.shortName}</span>
                      <span className="text-[10px] font-mono text-muted/70">{acct.currency}</span>
                    </div>
                    <span className={`text-xs font-mono tabular-nums ${
                      isPending ? 'text-muted' : isNeg ? 'text-rose' : 'text-slate'
                    }`}>
                      {isPending ? '—' : fmt(balDisp, activeCurrency)}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-sage" />
          <span className="text-[10px] font-mono text-muted">Reconciled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-amber" />
          <span className="text-[10px] font-mono text-muted">Awaiting reconciliation</span>
        </div>
      </div>
    </div>
  )
}

/** Budget burn rates — current month only, top 4 categories with spend */
function BurnRates() {
  const selectBurnRate    = useMinervaStore(s => s.selectBurnRate)
  const selectCurrentBudget = useMinervaStore(s => s.selectCurrentBudget)
  const budget            = selectCurrentBudget()

  if (!budget) return null

  const monthLabel = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Only show categories that have a limit set
  const cats = Object.entries(budget.categories)
    .filter(([, v]) => v.limit > 0)

  if (!cats.length) return null

  return (
    <div className="px-5 mt-6">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[11px] font-mono text-muted uppercase tracking-widest">
          Budget · {monthLabel}
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        {cats.map(([cat, meta], i) => {
          const spent  = selectBurnRate(cat)
          const limit  = meta.limit
          const pct    = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
          const over   = spent > limit && limit > 0
          const catMeta = CATEGORY_META[cat]

          return (
            <div
              key={cat}
              className={`px-4 py-3 ${i < cats.length - 1 ? 'border-b border-border/60' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm leading-none">{catMeta?.icon ?? '📦'}</span>
                  <span className="text-xs text-slate">{catMeta?.label ?? cat}</span>
                </div>
                <div className="flex items-center gap-2">
                  {over && (
                    <span className="text-[10px] font-mono text-rose font-semibold">OVER</span>
                  )}
                  <span className="text-xs font-mono tabular-nums text-muted">
                    {fmt(spent, 'AED')} / {fmt(limit, 'AED')}
                  </span>
                </div>
              </div>

              {/* Progress bar — intentionally thin */}
              <div className="h-[3px] bg-alabaster rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    over ? 'bg-rose' : pct > 80 ? 'bg-amber' : 'bg-sage'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Recent transactions — last 8, pure from store */
function RecentTransactions() {
  const transactions  = useMinervaStore(s => s.transactions)
  const activeCurrency = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay = useMinervaStore(s => s.selectInDisplayCurrency)
  const fx            = useMinervaStore(s => s.fx)

  const toAED = (amount, currency) => {
    if (currency === 'AED') return amount
    if (currency === 'USD') return amount * fx.USD_AED
    if (currency === 'INR') return amount * fx.INR_AED
    if (currency === 'SGD') return amount * fx.SGD_AED
    return amount
  }

  const recent = [...transactions]
    .filter(t => t.type !== 'reconciliation_adjustment')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)

  return (
    <div className="px-5 mt-6">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[11px] font-mono text-muted uppercase tracking-widest">
          Recent Transactions
        </p>
        {transactions.length > 0 && (
          <p className="text-[10px] font-mono text-muted">
            {transactions.filter(t => t.status === 'pending').length} pending
          </p>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border px-4 py-8 text-center">
          <p className="text-xs text-muted">No transactions logged yet.</p>
          <p className="text-[10px] font-mono text-muted/60 mt-1">
            Tap + to log your first transaction.
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {recent.map((txn, i) => {
            const catMeta    = CATEGORY_META[txn.category]
            const amountAED  = toAED(txn.amount, txn.currency)
            const display    = selectInDisplay(amountAED)
            const isPositive = txn.amount > 0
            const isAdj      = txn.type === 'reconciliation_adjustment'

            // Format date as "08 May"
            const dateLabel = new Date(txn.date).toLocaleDateString('en-GB', {
              day: '2-digit', month: 'short'
            })

            return (
              <div
                key={txn.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < recent.length - 1 ? 'border-b border-border/50' : ''
                }`}
              >
                {/* Category icon */}
                <span className="text-base leading-none flex-shrink-0 w-5 text-center">
                  {isAdj ? '⚖️' : catMeta?.icon ?? '📦'}
                </span>

                {/* Description + date */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate truncate">
                    {txn.description || catMeta?.label || txn.category}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-muted">{dateLabel}</span>
                    {txn.status === 'reconciled' && (
                      <span className="text-[9px] font-mono text-sage">✓ reconciled</span>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <span className={`text-xs font-mono font-semibold tabular-nums flex-shrink-0 ${
                  isAdj ? 'text-teal' : isPositive ? 'text-sage' : 'text-rose'
                }`}>
                  {isPositive ? '+' : ''}{fmt(display, activeCurrency)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Reconciliation status strip — which accounts need attention */
function ReconciliationStatus() {
  const ownerFilter       = useMinervaStore(s => s.ownerFilter)
  const _allAccounts      = useMinervaStore(s => s.accounts)
  const accounts          = (!ownerFilter || ownerFilter === 'all')
    ? _allAccounts
    : ownerFilter === 'Family'
      ? _allAccounts.filter(a => a.owner === 'Family')
      : _allAccounts.filter(a => a.owner === ownerFilter || a.owner === 'Family')
  const transactions      = useMinervaStore(s => s.transactions)

  // Accounts that have pending transactions but no reconciliation yet
  const pendingTxnAccountIds = new Set(
    transactions.filter(t => t.status === 'pending').map(t => t.accountId)
  )

  const needsAttention = accounts.filter(a =>
    a.active && pendingTxnAccountIds.has(a.id)
  )

  if (!needsAttention.length) return null

  return (
    <div className="mx-5 mt-4 rounded-2xl bg-amber-lt border border-amber/20 px-4 py-3">
      <p className="text-[10px] font-mono text-amber uppercase tracking-widest mb-1.5">
        Reconciliation Needed
      </p>
      <div className="space-y-1">
        {needsAttention.slice(0, 4).map(a => {
          const count = transactions.filter(t => t.accountId === a.id && t.status === 'pending').length
          return (
            <div key={a.id} className="flex items-center justify-between">
              <span className="text-xs text-slate">{a.name}</span>
              <span className="text-[10px] font-mono text-amber">{count} pending</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── SURPLUS PILL ────────────────────────────────────────────────────────────
// Single health indicator. Shows surplus envelope vs activity spend.
// White when healthy. Amber when surplus < 0. Sits inside the navy header.

function SurplusPill() {
  const selectSurplus  = useMinervaStore(s => s.selectSurplus)
  const activeCurrency = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay = useMinervaStore(s => s.selectInDisplayCurrency)
  const { surplus, utilized, isHealthy, gross } = selectSurplus()

  const displaySurplus = selectInDisplay(Math.abs(surplus))
  const displayGross   = selectInDisplay(gross)

  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-all ${
      isHealthy
        ? 'bg-white/8 border-white/10'
        : 'bg-amber/15 border-amber/30'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-sage' : 'bg-amber'}`} />
        <span className={`text-[10px] font-mono uppercase tracking-widest ${
          isHealthy ? 'text-white/50' : 'text-amber/80'
        }`}>
          {isHealthy ? 'Surplus' : 'Deficit'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {/* Utilization bar */}
        <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              !isHealthy ? 'bg-amber' : utilized > 80 ? 'bg-amber/60' : 'bg-sage'
            }`}
            style={{ width: `${Math.min(utilized, 100)}%` }}
          />
        </div>
        <span className={`text-xs font-mono font-semibold tabular-nums ${
          isHealthy ? 'text-white/80' : 'text-amber'
        }`}>
          {isHealthy ? '+' : '−'}{fmt(displaySurplus, activeCurrency, { compact: true })}
        </span>
      </div>
    </div>
  )
}

// ─── VIEW TOGGLE ─────────────────────────────────────────────────────────────

function ViewToggle({ active, onChange }) {
  return (
    <div className="flex items-center bg-white/10 rounded-xl p-0.5 gap-0.5">
      {[
        { id: 'activity', label: 'Activity' },
        { id: 'hawkeye',  label: 'Hawk Eye' },
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex-1 py-1.5 px-4 rounded-[10px] text-[11px] font-mono font-medium
            tracking-wide transition-all duration-150 active:scale-[0.97]
            ${active === tab.id
              ? 'bg-white text-navy shadow-sm'
              : 'text-white/45 hover:text-white/70'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ─── HAWK EYE VIEW ───────────────────────────────────────────────────────────
// High-altitude wealth snapshot. No transactions. No dates. No clutter.
// Assets left (sage). Liabilities right (rose). Net worth centred at top.

function HawkEye() {
  const [drawerItem, setDrawerItem] = useState(null)  // { id, label, sub, aed, side }
  const ownerFilter       = useMinervaStore(s => s.ownerFilter)
  const netWorth          = useMinervaStore(s => s.netWorth)
  const _accounts         = useMinervaStore(s => s.accounts)
  const _assets           = useMinervaStore(s => s.assets)
  const _liabilities      = useMinervaStore(s => s.liabilities)

  // Inline filter — reactive because ownerFilter + raw collections are both subscribed
  const filterByOwner = (items) => {
    if (!ownerFilter || ownerFilter === 'all') return items
    if (ownerFilter === 'Family') return items.filter(i => i.owner === 'Family')
    return items.filter(i => i.owner === ownerFilter || i.owner === 'Family')
  }
  const accounts    = filterByOwner(_accounts)
  const assets      = filterByOwner(_assets)
  const liabilities = filterByOwner(_liabilities)
  const activeCurrency    = useMinervaStore(s => s.activeCurrency)
  const selectLiveBalance = useMinervaStore(s => s.selectLiveBalance)
  const selectInDisplay   = useMinervaStore(s => s.selectInDisplayCurrency)
  const fx                = useMinervaStore(s => s.fx)

  const toAED = (amount, currency) => {
    if (!amount) return 0
    if (currency === 'AED') return amount
    if (currency === 'USD') return amount * fx.USD_AED
    if (currency === 'INR') return amount * fx.INR_AED
    if (currency === 'SGD') return amount * fx.SGD_AED
    return amount
  }

  const nw         = selectInDisplay(netWorth)
  const isPositive = nw >= 0

  // ── Asset rows: accounts with positive live balance + all asset valuations ──
  const cashAssets = accounts
    .filter(a => a.active && !['credit_card'].includes(a.type))
    .map(a => ({
      id:    a.id,
      label: a.shortName,
      sub:   a.currency,
      aed:   toAED(selectLiveBalance(a.id), a.currency),
      kind:  'account',
      side:  'asset',
    }))
    .filter(r => r.aed > 0.5)
    .sort((a, b) => b.aed - a.aed)

  const physicalAssets = assets.map(a => ({
    id:    a.id,
    label: a.name.split('—')[0].trim(),
    sub:   a.valuationBasis?.replace('_', ' '),
    aed:   a.valuationAED ?? 0,
    kind:  'asset',
    side:  'asset',
  })).filter(r => r.aed > 0).sort((a, b) => b.aed - a.aed)

  const allAssets = [...cashAssets, ...physicalAssets]

  // ── Liability rows: credit card live balances + structured liabilities ──
  const ccLiabilities = accounts
    .filter(a => a.active && a.type === 'credit_card')
    .map(a => ({
      id:    a.id,
      label: a.shortName,
      sub:   a.currency,
      aed:   toAED(Math.max(0, selectLiveBalance(a.id)), a.currency),
      kind:  'account',
      side:  'liability',
    }))
    .filter(r => r.aed > 0.5)
    .sort((a, b) => b.aed - a.aed)

  const structuredLiabilities = liabilities.map(l => ({
    id:    l.id,
    label: l.name.split('—')[0].trim(),
    sub:   `${l.interestRate ? l.interestRate + '%' : ''} ${l.currency}`.trim(),
    aed:   toAED(l.outstandingBalance ?? 0, l.currency),
    kind:  'liability',
    side:  'liability',
  })).filter(r => r.aed > 0).sort((a, b) => b.aed - a.aed)

  const allLiabilities = [...structuredLiabilities, ...ccLiabilities]

  const totalAssetsAED = allAssets.reduce((s, r) => s + r.aed, 0)
  const totalLiabsAED  = allLiabilities.reduce((s, r) => s + r.aed, 0)

  return (
    <div className="px-4 pt-4 pb-28 space-y-5">

      {/* ── Net Worth Hero ─────────────────────────────────────────────────── */}
      <div className="text-center py-6 px-4">
        <p className="text-[10px] font-mono text-muted uppercase tracking-[0.2em] mb-3">
          Total Net Worth
        </p>
        <p className={`text-[42px] font-bold leading-none tracking-tight tabular-nums
          ${isPositive ? 'text-navy' : 'text-rose'}`}
        >
          {fmt(Math.abs(nw), activeCurrency, { compact: false })}
        </p>
        {!isPositive && (
          <p className="text-xs font-mono text-rose/70 mt-1">net deficit</p>
        )}

        {/* Asset vs liability bar */}
        <div className="mt-5 flex rounded-full overflow-hidden h-1.5 gap-px">
          {totalAssetsAED > 0 && (
            <div
              className="bg-sage/60 rounded-l-full transition-all duration-700"
              style={{ flex: totalAssetsAED }}
            />
          )}
          {totalLiabsAED > 0 && (
            <div
              className="bg-rose/40 rounded-r-full transition-all duration-700"
              style={{ flex: totalLiabsAED }}
            />
          )}
        </div>
        <div className="flex justify-between mt-1.5 px-0.5">
          <span className="text-[9px] font-mono text-sage/70">
            {fmt(selectInDisplay(totalAssetsAED), activeCurrency, { compact: true })} assets
          </span>
          <span className="text-[9px] font-mono text-rose/70">
            {fmt(selectInDisplay(totalLiabsAED), activeCurrency, { compact: true })} liabilities
          </span>
        </div>
      </div>

      {/* ── Dual columns ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 items-start">

        {/* LEFT — Assets */}
        <div>
          <p className="text-[9px] font-mono text-sage uppercase tracking-widest mb-2 px-1">
            Assets
          </p>
          <div className="space-y-1.5">
            {allAssets.map(row => (
              <HawkRow
                key={row.id}
                label={row.label}
                sub={row.sub}
                aed={row.aed}
                activeCurrency={activeCurrency}
                selectInDisplay={selectInDisplay}
                side="asset"
              />
            ))}
            {allAssets.length === 0 && (
              <div className="rounded-xl bg-sage-lt/30 border border-sage/10 px-3 py-4 text-center">
                <p className="text-[10px] font-mono text-sage/50">No assets anchored yet</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Liabilities */}
        <div>
          <p className="text-[9px] font-mono text-rose uppercase tracking-widest mb-2 px-1">
            Liabilities
          </p>
          <div className="space-y-1.5">
            {allLiabilities.map(row => (
              <HawkRow
                key={row.id}
                label={row.label}
                sub={row.sub}
                aed={row.aed}
                activeCurrency={activeCurrency}
                selectInDisplay={selectInDisplay}
                side="liability"
              />
            ))}
            {allLiabilities.length === 0 && (
              <div className="rounded-xl bg-rose-lt/30 border border-rose/10 px-3 py-4 text-center">
                <p className="text-[10px] font-mono text-rose/50">No liabilities</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Asset / Liability detail drawer */}
      {drawerItem && (
        <AssetDrawer
          item={drawerItem}
          onClose={() => setDrawerItem(null)}
          activeCurrency={activeCurrency}
          selectInDisplay={selectInDisplay}
        />
      )}
    </div>
  )
}

/** Single Hawk Eye row — tappable. Opens detail drawer. */
function HawkRow({ label, sub, aed, activeCurrency, selectInDisplay, side, onTap }) {
  const display = selectInDisplay(aed)
  const isSage  = side === 'asset'

  return (
    <button
      onClick={onTap}
      className={`w-full text-left rounded-xl px-3 py-2 border transition-all active:scale-[0.97] ${
        isSage
          ? 'bg-sage-lt/30 border-sage/12 active:bg-sage-lt/60'
          : 'bg-rose-lt/30 border-rose/12 active:bg-rose-lt/60'
      }`}
    >
      <p className={`text-[11px] font-medium leading-tight truncate ${
        isSage ? 'text-sage' : 'text-rose'
      }`}>
        {label}
      </p>
      {sub && (
        <p className={`text-[9px] font-mono mt-0.5 truncate ${
          isSage ? 'text-sage/50' : 'text-rose/50'
        }`}>
          {sub}
        </p>
      )}
      <p className={`text-[12px] font-mono font-semibold tabular-nums mt-1.5 ${
        isSage ? 'text-sage' : 'text-rose'
      }`}>
        {fmt(display, activeCurrency, { compact: true })}
      </p>
    </button>
  )
}

// ─── ASSET DETAIL DRAWER ─────────────────────────────────────────────────────
// Slides up from bottom when a Hawk Eye row is tapped.
// Shows valuation details + linked documents from the Unified Vault.

function AssetDrawer({ item, onClose, activeCurrency, selectInDisplay }) {
  const selectDocsForAsset     = useMinervaStore(s => s.selectDocsForAsset)
  const selectDocsForLiability = useMinervaStore(s => s.selectDocsForLiability)

  if (!item) return null

  const docs = item.side === 'asset'
    ? selectDocsForAsset(item.id)
    : selectDocsForLiability(item.id)

  const display = selectInDisplay(item.aed)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-navy/40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto">
        <div className="bg-surface rounded-t-3xl px-5 pt-4 pb-10">
          {/* Handle */}
          <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

          {/* Identity */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 mr-3">
              <p className={`text-xs font-mono uppercase tracking-widest mb-1 ${
                item.side === 'asset' ? 'text-sage' : 'text-rose'
              }`}>
                {item.side === 'asset' ? 'Asset' : 'Liability'}
              </p>
              <h3 className="text-base font-bold text-navy leading-tight">{item.label}</h3>
              {item.sub && (
                <p className="text-xs font-mono text-muted mt-0.5">{item.sub}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-xl font-mono font-bold tabular-nums ${
                item.side === 'asset' ? 'text-sage' : 'text-rose'
              }`}>
                {fmt(display, activeCurrency, { compact: true })}
              </p>
              <p className="text-[9px] font-mono text-muted mt-0.5">{activeCurrency}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border mb-4" />

          {/* Documents section */}
          <div>
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-3">
              Linked Documents
              {docs.length > 0 && (
                <span className="ml-2 text-navy font-semibold">{docs.length}</span>
              )}
            </p>

            {docs.length === 0 ? (
              <div className="text-center py-5 bg-alabaster rounded-xl border border-border">
                <p className="text-xs text-muted">No documents linked.</p>
                <p className="text-[10px] font-mono text-muted/60 mt-1">
                  Add documents in the Docs tab and link them here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between bg-alabaster rounded-xl px-3 py-2.5 border border-border">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
                      <span className="text-sm flex-shrink-0">
                        {doc.category === 'legal' ? '📋'
                          : doc.category === 'statement' ? '📄'
                          : doc.category === 'property' ? '🏠'
                          : '📎'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate truncate">{doc.title}</p>
                        {doc.tags?.length > 0 && (
                          <p className="text-[9px] font-mono text-muted mt-0.5 truncate">
                            {doc.tags.slice(0, 3).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    {doc.driveUrl ? (
                      <a
                        href={doc.driveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-shrink-0 px-2 py-1 rounded-lg bg-blue-lt text-blue text-[10px] font-mono"
                      >
                        Open ↗
                      </a>
                    ) : (
                      <span className="flex-shrink-0 text-[9px] font-mono text-muted/50">
                        No URL
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── DASHBOARD (root) ─────────────────────────────────────────────────────────

export function Dashboard({ onOpenReconcile }) {
  const openReconcile = onOpenReconcile ?? (() => {})
  const [view, setView] = useState('activity')   // 'activity' | 'hawkeye'

  return (
    <div className="min-h-screen bg-alabaster pb-28">

      {/* ── Shared header (always shown) ─────────────────────────────────── */}
      <div className="px-5 pt-14 pb-5 bg-navy">
        <div className="flex items-center gap-3 mb-4">
          <img
            src="/Minerva/icons/logo-header.png"
            alt="Minerva"
            className="w-8 h-8 rounded-lg opacity-90"
          />
          <p className="text-[10px] font-mono tracking-[0.2em] uppercase" style={{color: '#CBD5E1'}}>
            Minerva · Command Centre
          </p>
        </div>

        {/* View toggle — sits above the metrics */}
        <div className="mb-3">
          <ViewToggle active={view} onChange={setView} />
        </div>

        {/* Owner filter — persistent across Activity and Hawk Eye */}
        <div className="mb-4">
          <OwnerFilter />
        </div>

        {/* Activity header: liquid cash */}
        {view === 'activity' && (
          <>
            <p className="text-[11px] font-mono text-white/40 uppercase tracking-widest mb-1">
              Liquid Cash
            </p>
            <ActivityHero />
          </>
        )}

        {/* Hawk Eye header: net worth */}
        {view === 'hawkeye' && (
          <p className="text-[11px] font-mono text-white/40 uppercase tracking-widest">
            Wealth Overview
          </p>
        )}

        {/* Surplus health pill — Activity only */}
        {view === 'activity' && (
          <div className="mt-3">
            <SurplusPill />
          </div>
        )}

        {/* Currency toggle — shared */}
        <div className="mt-3">
          <CurrencyToggle />
        </div>
      </div>

      {/* ── View body ────────────────────────────────────────────────────── */}
      {view === 'activity' && (
        <>
          <SurplusEngine />
          <CapitalAllocation />
          <SurplusProjection />
          <FCNRBanner />
          <ReconcileBar onOpenOpening={openReconcile} onOpenReconcile={openReconcile} />
          <ReconciliationStatus />
          <CashByCountry />
          <BurnRates />
          <RecentTransactions />
          <div className="h-6" />
        </>
      )}

      {view === 'hawkeye' && <HawkEye />}
    </div>
  )
}

// ─── Reconciliation Action Bar ────────────────────────────────────────────────
// Shown at top of Dashboard so it's never buried. Two entry points:
//   1. Opening Balances — first-time setup
//   2. Reconcile Account — monthly close flow

export function ReconcileBar({ onOpenOpening, onOpenReconcile }) {
  const ownerFilter   = useMinervaStore(s => s.ownerFilter)
  const _allAccounts  = useMinervaStore(s => s.accounts)
  const accounts      = (!ownerFilter || ownerFilter === 'all')
    ? _allAccounts
    : ownerFilter === 'Family'
      ? _allAccounts.filter(a => a.owner === 'Family')
      : _allAccounts.filter(a => a.owner === ownerFilter || a.owner === 'Family')
  const transactions  = useMinervaStore(s => s.transactions)

  const pendingCount  = transactions.filter(t => t.status === 'pending').length
  const noneAnchored  = accounts.every(a => !a.reconciledAt)
  const anchoredCount = accounts.filter(a => !!a.reconciledAt).length

  if (noneAnchored) return null  // handled by App.jsx banner

  return (
    <div className="px-5 mt-4 flex gap-2">
      <button
        onClick={onOpenOpening}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-surface border border-border rounded-2xl text-xs font-semibold text-slate active:scale-[0.98] transition-all"
      >
        <span>⚓</span>
        <span>Opening Balances</span>
        <span className="text-[10px] font-mono text-muted">({anchoredCount}/{accounts.length})</span>
      </button>
      <button
        onClick={onOpenReconcile}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-semibold active:scale-[0.98] transition-all
          ${pendingCount > 0
            ? 'bg-amber-lt border border-amber/25 text-amber'
            : 'bg-surface border border-border text-slate'
          }`}
      >
        <span>⚖️</span>
        <span>Reconcile</span>
        {pendingCount > 0 && (
          <span className="text-[10px] font-mono">({pendingCount})</span>
        )}
      </button>
    </div>
  )
}
