// src/components/shared/SurplusProjection.jsx
// Surplus Projection Card — forward-looking
//
// Shows:
//   Average Monthly Surplus  = (total income - total expenses) / months of data
//   Projected Balance 3M     = currentBalance + (avg * 3)
//   Projected Balance 6M     = currentBalance + (avg * 6)
//
// Colour: sage if avg surplus > 0 (growing), rose if < 0 (depleting)

import { useMinervaStore } from '../../state/store.js'
import { fmt }             from '../../utils/currency.js'

export function SurplusProjection() {
  const selectSurplusProjection = useMinervaStore(s => s.selectSurplusProjection)
  const activeCurrency          = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay         = useMinervaStore(s => s.selectInDisplayCurrency)
  const transactions            = useMinervaStore(s => s.transactions) // subscribe

  const {
    avgMonthlySurplus,
    monthsOfData,
    projected3M,
    projected6M,
    currentBalance,
    hasData,
  } = selectSurplusProjection()

  const isGrowing  = avgMonthlySurplus >= 0
  const borderColor = isGrowing ? 'border-sage/25' : 'border-rose/25'
  const bgColor     = isGrowing ? 'bg-sage-lt/30' : 'bg-rose-lt/30'

  const dispAvg     = selectInDisplay(Math.abs(avgMonthlySurplus))
  const dispCurrent = selectInDisplay(currentBalance)
  const disp3M      = selectInDisplay(projected3M)
  const disp6M      = selectInDisplay(projected6M)

  // Now + 3 months / 6 months labels
  const now   = new Date()
  const date3 = new Date(now); date3.setMonth(date3.getMonth() + 3)
  const date6 = new Date(now); date6.setMonth(date6.getMonth() + 6)
  const label3 = date3.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
  const label6 = date6.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })

  return (
    <div className={`mx-5 mt-3 rounded-2xl border px-4 py-3 ${bgColor} ${borderColor}`}>

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-0.5">
            Surplus Projection
          </p>
          {hasData ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <p className={`text-xl font-bold font-mono tabular-nums leading-none ${
                  isGrowing ? 'text-sage' : 'text-rose'
                }`}>
                  {isGrowing ? '+' : '−'}{fmt(dispAvg, activeCurrency, { compact: false })}
                </p>
                <p className="text-[10px] font-mono text-muted">/month avg</p>
              </div>
              <p className="text-[10px] font-mono text-muted mt-1">
                Based on {monthsOfData} completed month{monthsOfData !== 1 ? 's' : ''} of data
              </p>
            </>
          ) : (
            <p className="text-xs text-muted font-mono mt-1">
              Log transactions across months to see projection
            </p>
          )}
        </div>

        {/* Trend badge */}
        <div className={`flex-shrink-0 px-2.5 py-1 rounded-xl text-[10px] font-mono font-semibold ${
          !hasData    ? 'bg-border text-muted'
          : isGrowing ? 'bg-sage text-white'
          : 'bg-rose text-white'
        }`}>
          {!hasData ? '— No data' : isGrowing ? '▲ Growing' : '▼ Depleting'}
        </div>
      </div>

      {/* Three projections */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-black/8">

        {/* Current */}
        <div>
          <p className="text-[9px] font-mono text-muted uppercase tracking-wide mb-1">Now</p>
          <p className="text-[12px] font-mono font-semibold text-slate tabular-nums">
            {fmt(dispCurrent, activeCurrency, { compact: true })}
          </p>
          <p className="text-[9px] font-mono text-muted/60 mt-0.5">
            {new Date().toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
          </p>
        </div>

        {/* 3 months */}
        <div>
          <p className="text-[9px] font-mono text-muted uppercase tracking-wide mb-1">+3 Months</p>
          <p className={`text-[12px] font-mono font-semibold tabular-nums ${
            projected3M >= currentBalance ? 'text-sage' : 'text-rose'
          }`}>
            {fmt(disp3M, activeCurrency, { compact: true })}
          </p>
          <p className="text-[9px] font-mono text-muted/60 mt-0.5">{label3}</p>
        </div>

        {/* 6 months */}
        <div>
          <p className="text-[9px] font-mono text-muted uppercase tracking-wide mb-1">+6 Months</p>
          <p className={`text-[12px] font-mono font-semibold tabular-nums ${
            projected6M >= currentBalance ? 'text-sage' : 'text-rose'
          }`}>
            {fmt(disp6M, activeCurrency, { compact: true })}
          </p>
          <p className="text-[9px] font-mono text-muted/60 mt-0.5">{label6}</p>
        </div>
      </div>

      {/* Trajectory bar */}
      {hasData && (
        <div className="mt-3 pt-2 border-t border-black/5">
          <div className="flex items-center justify-between text-[9px] font-mono text-muted mb-1">
            <span>Balance trajectory</span>
            <span>{isGrowing ? 'On track to grow' : 'Depleting — review spending'}</span>
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isGrowing ? 'bg-sage' : 'bg-rose'}`}
              style={{
                width: isGrowing
                  ? `${Math.min((avgMonthlySurplus / (currentBalance || 1)) * 100 * 12, 100)}%`
                  : '100%'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
