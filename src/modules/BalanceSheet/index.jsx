// src/modules/BalanceSheet/index.jsx
// Balance Sheet — deep view
//
// Features:
//   • Equity calculation per asset (value − linked liability)
//   • LTV % for mortgaged properties
//   • Inline valuation update via FAB-style sheet
//   • Liability detail with EMI, rate, maturity, monthly interest cost
//   • Valuation history (last entry shown)
//   • Month-over-month net worth change indicator
//   • All data from Zustand selectors — zero local financial state

import { useState }           from 'react'
import { useMinervaStore }    from '../../state/store.js'
import { fmt }                from '../../utils/currency.js'
import { formatDate }         from '../../utils/dates.js'
import { CurrencyToggle }     from '../../components/shared/CurrencyToggle.jsx'
import { OwnerFilter }       from '../../components/shared/OwnerFilter.jsx'
import { Pill }               from '../../components/shared/Card.jsx'

const ASSET_TYPE_META = {
  property:    { label: 'Properties',    icon: '🏠', color: 'sage'  },
  investment:  { label: 'Investments',   icon: '📈', color: 'blue'  },
  pension:     { label: 'Pensions',      icon: '🎖️', color: 'teal'  },
  other:       { label: 'Other Assets',  icon: '💎', color: 'amber' },
}

// ─── Valuation Update Sheet ───────────────────────────────────────────────────

function ValuationSheet({ asset, onClose }) {
  const updateAssetValuation = useMinervaStore(s => s.updateAssetValuation)
  const activeCurrency       = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay      = useMinervaStore(s => s.selectInDisplayCurrency)

  const [value, setValue] = useState(String(asset.valuationAED ?? ''))
  const [basis, setBasis] = useState(asset.valuationBasis ?? 'market_estimate')
  const parsed = parseFloat(value.replace(/,/g, ''))
  const hasChange = !isNaN(parsed) && parsed !== asset.valuationAED

  const currentDisplay = selectInDisplay(asset.valuationAED ?? 0)
  const newDisplay     = !isNaN(parsed) ? selectInDisplay(parsed) : null
  const delta          = !isNaN(parsed) ? parsed - (asset.valuationAED ?? 0) : 0

  const handleSave = () => {
    if (isNaN(parsed)) return
    updateAssetValuation(asset.id, parsed, basis)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy/40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto">
        <div className="bg-surface rounded-t-3xl px-5 pt-4 pb-10">
          <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Update Valuation</p>
              <h3 className="text-base font-bold text-navy leading-tight">{asset.name.split('—')[0].trim()}</h3>
            </div>
            <button onClick={onClose} className="text-muted text-sm font-mono">✕</button>
          </div>

          {/* Current vs new */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-alabaster rounded-xl px-3 py-2.5 border border-border">
              <p className="text-[9px] font-mono text-muted uppercase tracking-wide">Current</p>
              <p className="text-sm font-mono font-semibold text-slate mt-1 tabular-nums">
                {fmt(currentDisplay, activeCurrency)}
              </p>
            </div>
            <div className={`rounded-xl px-3 py-2.5 border ${
              newDisplay !== null
                ? delta >= 0 ? 'bg-sage-lt/40 border-sage/20' : 'bg-rose-lt/40 border-rose/20'
                : 'bg-alabaster border-border'
            }`}>
              <p className="text-[9px] font-mono text-muted uppercase tracking-wide">New</p>
              <p className={`text-sm font-mono font-semibold mt-1 tabular-nums ${
                newDisplay !== null ? delta >= 0 ? 'text-sage' : 'text-rose' : 'text-muted'
              }`}>
                {newDisplay !== null ? fmt(newDisplay, activeCurrency) : '—'}
              </p>
            </div>
          </div>

          {/* Delta indicator */}
          {hasChange && (
            <div className={`mb-3 text-center py-1.5 rounded-xl text-xs font-mono font-semibold ${
              delta >= 0 ? 'bg-sage-lt text-sage' : 'bg-rose-lt text-rose'
            }`}>
              {delta >= 0 ? '▲' : '▼'} {fmt(Math.abs(delta), 'AED')} AED
              {' '}({delta >= 0 ? '+' : ''}{((delta / (asset.valuationAED || 1)) * 100).toFixed(1)}%)
            </div>
          )}

          {/* New value input */}
          <div className="mb-3">
            <p className="text-[9px] font-mono text-muted uppercase tracking-wide mb-1.5">New Value (AED)</p>
            <input
              type="number"
              placeholder={String(asset.valuationAED ?? 0)}
              value={value}
              onChange={e => setValue(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 text-lg font-mono font-semibold text-navy bg-alabaster border border-border rounded-2xl focus:outline-none focus:border-blue transition-colors tabular-nums"
            />
          </div>

          {/* Basis */}
          <div className="mb-5">
            <p className="text-[9px] font-mono text-muted uppercase tracking-wide mb-1.5">Valuation Basis</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { v: 'market_estimate', l: 'Market Estimate' },
                { v: 'confirmed',       l: 'Confirmed Report' },
                { v: 'cost',            l: 'Cost Basis'       },
                { v: 'nav',             l: 'NAV (Statement)'  },
              ].map(opt => (
                <button key={opt.v} onClick={() => setBasis(opt.v)}
                  className={`py-2 rounded-xl text-[11px] font-mono border transition-all ${
                    basis === opt.v
                      ? 'bg-navy text-white border-navy'
                      : 'bg-alabaster text-muted border-border'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!hasChange}
            className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] ${
              hasChange ? 'bg-sage text-white' : 'bg-alabaster text-muted border border-border cursor-not-allowed'
            }`}
          >
            {hasChange ? 'Update Valuation' : 'No change'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Asset Row (expanded) ─────────────────────────────────────────────────────

function AssetRow({ asset, onUpdateValuation }) {
  const activeCurrency   = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay  = useMinervaStore(s => s.selectInDisplayCurrency)
  const selectAssetEquity = useMinervaStore(s => s.selectAssetEquity)

  const equity  = selectAssetEquity(asset.id)
  const display = selectInDisplay(asset.valuationAED ?? 0)
  const hasLinkedLiab = !!asset.linkedLiabilityId
  const history = asset.valuationHistory ?? []

  return (
    <div className="border-b border-border/50 last:border-0">
      {/* Main row */}
      <div className="px-3 py-3">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 mr-3 min-w-0">
            <p className="text-xs font-semibold text-slate leading-tight">{asset.name}</p>
            <div className="flex items-center flex-wrap gap-1 mt-1">
              <Pill label={asset.owner}   color="blue" />
              <Pill label={asset.country} color="muted" />
              <Pill label={(asset.valuationBasis ?? 'estimate').replace(/_/g,' ')} color="muted" />
              {asset.valuationDate && (
                <span className="text-[9px] font-mono text-muted/60">
                  {formatDate(asset.valuationDate, 'short')}
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-mono font-semibold text-sage tabular-nums">
              {fmt(display, activeCurrency)}
            </p>
            <button
              onClick={() => onUpdateValuation(asset)}
              className="text-[9px] font-mono text-blue mt-0.5 underline underline-offset-2"
            >
              update
            </button>
          </div>
        </div>

        {/* Equity breakdown — properties with mortgages */}
        {hasLinkedLiab && equity && (
          <div className="bg-alabaster rounded-xl px-3 py-2 mt-1 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-muted">Gross Value</span>
              <span className="text-[10px] font-mono text-slate tabular-nums">
                {fmt(selectInDisplay(equity.valuation), activeCurrency)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-muted">
                Debt ({equity.liability?.name?.split(' ')[0]})
              </span>
              <span className="text-[10px] font-mono text-rose tabular-nums">
                −{fmt(selectInDisplay(equity.debt), activeCurrency)}
              </span>
            </div>
            {/* LTV bar */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-mono text-muted">LTV</span>
                <span className={`text-[9px] font-mono font-semibold ${
                  equity.ltv > 80 ? 'text-rose' : equity.ltv > 60 ? 'text-amber' : 'text-sage'
                }`}>
                  {equity.ltv.toFixed(1)}%
                </span>
              </div>
              <div className="h-1 bg-white rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    equity.ltv > 80 ? 'bg-rose' : equity.ltv > 60 ? 'bg-amber' : 'bg-sage'
                  }`}
                  style={{ width: `${Math.min(equity.ltv, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between items-center pt-0.5 border-t border-border/50">
              <span className="text-[10px] font-mono font-semibold text-navy">Net Equity</span>
              <span className={`text-[10px] font-mono font-bold tabular-nums ${
                equity.equity >= 0 ? 'text-sage' : 'text-rose'
              }`}>
                {fmt(selectInDisplay(equity.equity), activeCurrency)}
              </span>
            </div>
          </div>
        )}

        {/* Valuation history — last update */}
        {history.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[9px] font-mono text-muted/60">
              Previously: {fmt(selectInDisplay(history[history.length - 1].valuationAED), activeCurrency)}
            </span>
            <span className="text-[9px] font-mono text-muted/40">
              · {formatDate(history[history.length - 1].valuationDate, 'short')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Liability Row ────────────────────────────────────────────────────────────

function LiabilityRow({ liability }) {
  const activeCurrency  = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay = useMinervaStore(s => s.selectInDisplayCurrency)
  const fx              = useMinervaStore(s => s.fx)

  const toAEDLocal = (amt, cur) => {
    if (cur === 'AED') return amt
    if (cur === 'USD') return amt * fx.USD_AED
    if (cur === 'INR') return amt * fx.INR_AED
    return amt
  }

  const balAED     = toAEDLocal(liability.outstandingBalance ?? 0, liability.currency)
  const display    = selectInDisplay(balAED)
  const monthlyInt = liability.interestRate && liability.outstandingBalance
    ? toAEDLocal((liability.outstandingBalance * liability.interestRate) / 100 / 12, liability.currency)
    : 0

  return (
    <div className="px-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex-1 mr-3 min-w-0">
          <p className="text-xs font-semibold text-slate">{liability.name}</p>
          <div className="flex items-center flex-wrap gap-1.5 mt-1">
            {liability.interestRate > 0 && (
              <Pill label={`${liability.interestRate}% p.a.`} color="amber" />
            )}
            {liability.maturityDate && (
              <Pill label={`Due ${formatDate(liability.maturityDate, 'short')}`} color="teal" />
            )}
            <Pill label={liability.currency} color="muted" />
          </div>
        </div>
        <p className="text-sm font-mono font-semibold text-rose tabular-nums flex-shrink-0">
          {fmt(display, activeCurrency)}
        </p>
      </div>

      {/* Detail row */}
      <div className="bg-rose-lt/25 rounded-xl px-3 py-2 space-y-1">
        {liability.monthlyPayment > 0 && (
          <div className="flex justify-between">
            <span className="text-[10px] font-mono text-muted">Monthly EMI</span>
            <span className="text-[10px] font-mono text-slate tabular-nums">
              {fmt(selectInDisplay(toAEDLocal(liability.monthlyPayment, liability.currency)), activeCurrency)}/mo
            </span>
          </div>
        )}
        {monthlyInt > 0 && (
          <div className="flex justify-between">
            <span className="text-[10px] font-mono text-muted">Interest Cost</span>
            <span className="text-[10px] font-mono text-rose tabular-nums">
              ~{fmt(selectInDisplay(monthlyInt), activeCurrency)}/mo
            </span>
          </div>
        )}
        {liability.notes && (
          <p className="text-[9px] text-muted/70 pt-0.5 leading-relaxed">{liability.notes}</p>
        )}
      </div>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export function BalanceSheet() {
  const activeCurrency     = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay    = useMinervaStore(s => s.selectInDisplayCurrency)
  const selectTotalAssetsAED    = useMinervaStore(s => s.selectTotalAssetsAED)
  const selectTotalLiabilitiesAED = useMinervaStore(s => s.selectTotalLiabilitiesAED)
  const selectNetWorthIn   = useMinervaStore(s => s.selectNetWorthIn)
  const selectNetWorthMoM  = useMinervaStore(s => s.selectNetWorthMoM)
  const ownerFilter        = useMinervaStore(s => s.ownerFilter)
  const _assets            = useMinervaStore(s => s.assets)
  const _liabilities       = useMinervaStore(s => s.liabilities)

  const filterByOwner = (items) => {
    if (!ownerFilter || ownerFilter === 'all') return items
    if (ownerFilter === 'Family') return items.filter(i => i.owner === 'Family')
    return items.filter(i => i.owner === ownerFilter || i.owner === 'Family')
  }
  const assets      = filterByOwner(_assets)
  const liabilities = filterByOwner(_liabilities)

  const [expandedType, setExpandedType]       = useState('property')
  const [valuationTarget, setValuationTarget] = useState(null) // asset being updated

  const totalAssets = selectInDisplay(selectTotalAssetsAED())
  const totalLiabs  = selectInDisplay(selectTotalLiabilitiesAED())
  const netWorth    = selectNetWorthIn(activeCurrency)
  const mom         = selectNetWorthMoM()

  const assetsByType = assets.reduce((g, a) => {
    if (!g[a.type]) g[a.type] = []
    g[a.type].push(a)
    return g
  }, {})

  return (
    <div className="min-h-screen bg-alabaster pb-28">

      {/* Header */}
      <div className="bg-navy px-5 pt-12 pb-5">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">
          Balance Sheet
        </p>
        {ownerFilter !== 'all' && (
          <p className="text-[10px] font-mono mb-2" style={{color: '#CBD5E1'}}>
            {ownerFilter === 'Family' ? 'Family / Joint' : ownerFilter}
          </p>
        )}

        {/* Three-column summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Assets',      value: totalAssets, color: 'text-sage-lt'  },
            { label: 'Liabilities', value: totalLiabs,  color: 'text-rose-lt'  },
            { label: 'Net Worth',   value: netWorth,    color: 'text-white'    },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={`text-sm font-bold font-mono tabular-nums ${s.color}`}>
                {fmt(s.value, activeCurrency, { compact: true })}
              </p>
              <p className="text-[9px] font-mono text-white/35 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* MoM change */}
        {mom && Math.abs(mom.drift) > 0.01 && (
          <div className={`text-center mb-3 py-1 rounded-xl text-[10px] font-mono ${
            mom.drift >= 0 ? 'text-sage-lt/80' : 'text-rose-lt/80'
          }`}>
            {mom.drift >= 0 ? '▲' : '▼'} {fmt(Math.abs(mom.drift), 'AED')} AED vs last reconciliation
          </div>
        )}

        <div className="mt-3">
          <OwnerFilter />
        </div>
        <div className="mt-3">
          <CurrencyToggle />
        </div>
      </div>

      <div className="px-5 mt-5 space-y-5">

        {/* ── Assets ─────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[11px] font-mono text-muted uppercase tracking-widest">Assets</p>
            <p className="text-[10px] font-mono text-muted">{assets.length} positions</p>
          </div>

          <div className="space-y-2">
            {Object.entries(ASSET_TYPE_META).map(([type, meta]) => {
              const group    = assetsByType[type] ?? []
              if (!group.length) return null
              const isOpen   = expandedType === type
              const groupAED = group.reduce((s, a) => s + (a.valuationAED ?? 0), 0)
              const groupDisplay = selectInDisplay(groupAED)

              return (
                <div key={type} className="bg-surface rounded-2xl border border-border overflow-hidden">
                  {/* Group header */}
                  <button
                    onClick={() => setExpandedType(isOpen ? null : type)}
                    className="w-full flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{meta.icon}</span>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-navy">{meta.label}</p>
                        <p className="text-[10px] font-mono text-muted">{group.length} position{group.length > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold text-sage tabular-nums">
                        {fmt(groupDisplay, activeCurrency, { compact: true })}
                      </span>
                      <span className="text-[10px] text-muted">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {/* Expanded rows */}
                  {isOpen && (
                    <div className="border-t border-border">
                      {group.map(asset => (
                        <AssetRow
                          key={asset.id}
                          asset={asset}
                          onUpdateValuation={a => setValuationTarget(a)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Liabilities ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[11px] font-mono text-muted uppercase tracking-widest">Liabilities</p>
            <p className="text-[10px] font-mono text-muted">{liabilities.length} obligations</p>
          </div>
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            {liabilities.map(l => <LiabilityRow key={l.id} liability={l} />)}
          </div>
        </div>

        {/* ── Net Worth footer card ────────────────────────────────────────── */}
        <div className="bg-navy rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                Household Net Worth
              </p>
              <p className={`text-2xl font-bold mt-1 tabular-nums ${
                netWorth >= 0 ? 'text-white' : 'text-rose-lt'
              }`}>
                {fmt(netWorth, activeCurrency)}
              </p>
            </div>
            <div className="font-mono font-bold text-3xl text-white/20">KA</div>
          </div>

          {/* Asset / liability ratio bar */}
          {totalAssets > 0 && (
            <div className="mt-3">
              <div className="flex rounded-full overflow-hidden h-1 gap-px">
                <div className="bg-sage/50 rounded-l-full" style={{ flex: totalAssets }} />
                <div className="bg-rose/40 rounded-r-full" style={{ flex: Math.max(totalLiabs, 0) }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] font-mono text-white/30">
                  {fmt(totalAssets, activeCurrency, { compact: true })} assets
                </span>
                <span className="text-[9px] font-mono text-white/30">
                  {fmt(totalLiabs, activeCurrency, { compact: true })} liabilities
                </span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Valuation update sheet */}
      {valuationTarget && (
        <ValuationSheet
          asset={valuationTarget}
          onClose={() => setValuationTarget(null)}
        />
      )}
    </div>
  )
}
