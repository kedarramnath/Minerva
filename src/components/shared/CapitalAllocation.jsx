// src/components/shared/CapitalAllocation.jsx
// Capital Allocation — Waterline & Investable Surplus Card
//
// Shows:
//   baselineLiquidity  = (avgMonthlyExpenses + mortgage) × 3  — the safety net
//   investableSurplus  = currentBalance - baselineLiquidity
//     > 0 → "Ready to Invest" — how much is available above the safety net
//     < 0 → "Shortfall to Baseline" — how far below the safety net you are
//   pctOfBaseline      — how far through building the safety net (progress bar)
//   waterlineCrossDate — day projection crosses the waterline (if below)
//
// Recalculates dynamically on any expense, mortgage, or balance change.

import { useMinervaStore } from '../../state/store.js'
import { fmt }             from '../../utils/currency.js'

export function CapitalAllocation() {
  const selectCapitalAllocation = useMinervaStore(s => s.selectCapitalAllocation)
  const activeCurrency          = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay         = useMinervaStore(s => s.selectInDisplayCurrency)
  // Subscribe for reactivity
  const transactions            = useMinervaStore(s => s.transactions)
  const plannedSpends           = useMinervaStore(s => s.plannedSpends)
  const surplusConfig           = useMinervaStore(s => s.surplusConfig)

  const {
    baselineLiquidity,
    investableSurplus,
    isAboveWaterline,
    pctOfBaseline,
    waterlineCrossDay,
    waterlineCrossDate,
    avgMonthlyExpenses,
    mortgageAED,
  } = selectCapitalAllocation()

  const dispBaseline   = selectInDisplay(baselineLiquidity)
  const dispInvestable = selectInDisplay(Math.abs(investableSurplus))
  const dispExpenses   = selectInDisplay(avgMonthlyExpenses)
  const dispMortgage   = selectInDisplay(mortgageAED)

  const crossLabel = waterlineCrossDate
    ? new Date(waterlineCrossDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    : null

  // Progress bar clamped 0–100%
  const pct = Math.min(Math.max(pctOfBaseline, 0), 100)

  return (
    <div className="mx-5 mt-3 bg-surface rounded-2xl border border-border overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3.5 pb-3 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">
              Capital Allocation
            </p>
            <p className={`text-xl font-bold font-mono tabular-nums leading-none ${
              isAboveWaterline ? 'text-sage' : 'text-rose'
            }`}>
              {isAboveWaterline ? '+' : '−'}{fmt(dispInvestable, activeCurrency)}
            </p>
            <p className={`text-[10px] font-mono mt-1 ${
              isAboveWaterline ? 'text-sage/80' : 'text-rose/80'
            }`}>
              {isAboveWaterline ? '✓ Ready to Invest' : '⚠ Shortfall to Baseline'}
            </p>
          </div>

          {/* Status badge */}
          <div className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-mono font-semibold ${
            isAboveWaterline
              ? 'bg-sage-lt text-sage'
              : 'bg-rose-lt text-rose'
          }`}>
            {isAboveWaterline ? '▲ Above' : '▼ Below'} Waterline
          </div>
        </div>

        {/* Progress bar toward baseline */}
        <div className="mt-3">
          <div className="flex justify-between text-[9px] font-mono text-muted mb-1.5">
            <span>Progress to safety net</span>
            <span>{pct.toFixed(0)}% of {fmt(dispBaseline, activeCurrency, { compact: true })}</span>
          </div>
          <div className="h-2 bg-alabaster rounded-full overflow-hidden border border-border/50">
            {/* Below-waterline fill (rose) */}
            {!isAboveWaterline && (
              <div
                className="h-full bg-rose/60 rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            )}
            {/* Above-waterline: two-tone — baseline in sage, investable in teal */}
            {isAboveWaterline && (
              <div className="h-full flex">
                <div className="h-full bg-sage/70 rounded-l-full" style={{ flex: 100 }} />
                <div
                  className="h-full bg-teal/60 rounded-r-full"
                  style={{ flex: Math.max(0, pct - 100) }}
                />
              </div>
            )}
          </div>
          {/* Waterline marker */}
          <div className="relative h-0">
            <div
              className="absolute top-[-10px] w-px h-3 bg-rose/60"
              style={{ left: '100%', transform: 'translateX(-1px)' }}
            />
          </div>
        </div>
      </div>

      {/* ── Breakdown ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-border">
        <div className="px-3 py-2.5">
          <p className="text-[9px] font-mono text-muted uppercase tracking-wide mb-1">Baseline (3×)</p>
          <p className="text-[11px] font-mono font-semibold text-slate tabular-nums">
            {fmt(dispBaseline, activeCurrency, { compact: true })}
          </p>
          <p className="text-[9px] font-mono text-muted/60 mt-0.5">safety net</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[9px] font-mono text-muted uppercase tracking-wide mb-1">Avg Monthly</p>
          <p className="text-[11px] font-mono font-semibold text-slate tabular-nums">
            {fmt(dispExpenses, activeCurrency, { compact: true })}
          </p>
          <p className="text-[9px] font-mono text-muted/60 mt-0.5">expenses</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[9px] font-mono text-muted uppercase tracking-wide mb-1">Mortgage</p>
          <p className="text-[11px] font-mono font-semibold text-slate tabular-nums">
            {fmt(dispMortgage, activeCurrency, { compact: true })}
          </p>
          <p className="text-[9px] font-mono text-muted/60 mt-0.5">AED/mo</p>
        </div>
      </div>

      {/* ── Waterline crossing ────────────────────────────────────────── */}
      {!isAboveWaterline && (
        <div className="border-t border-border px-4 py-2.5 flex items-center justify-between bg-rose-lt/20">
          {crossLabel ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-rose/60 flex-shrink-0" />
                <p className="text-[10px] font-mono text-rose/80">
                  Projected to cross waterline in <span className="font-semibold">{waterlineCrossDay} days</span>
                </p>
              </div>
              <p className="text-[10px] font-mono text-muted flex-shrink-0 ml-2">{crossLabel}</p>
            </>
          ) : (
            <p className="text-[10px] font-mono text-muted">
              Waterline not reached within 30-day projection — review spending
            </p>
          )}
        </div>
      )}

      {/* Above waterline — show investable amount clearly */}
      {isAboveWaterline && (
        <div className="border-t border-border px-4 py-2.5 flex items-center justify-between bg-sage-lt/30">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-sage flex-shrink-0" />
            <p className="text-[10px] font-mono text-sage">
              <span className="font-semibold">{fmt(dispInvestable, activeCurrency, { compact: true })}</span> available above safety net
            </p>
          </div>
          <p className="text-[10px] font-mono text-muted flex-shrink-0 ml-2">deploy →</p>
        </div>
      )}
    </div>
  )
}
