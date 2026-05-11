import { useMinervaStore } from '../../state/store.js'
import { fmt }             from '../../utils/currency.js'
import { CATEGORY_META }   from '../../theme.js'
import { CurrencyToggle }  from '../../components/shared/CurrencyToggle.jsx'
import { OwnerFilter }     from '../../components/shared/OwnerFilter.jsx'

const URGENCY_COLOR = (pct, over) => {
  if (over)     return { bar: 'bg-rose',  text: 'text-rose',  bg: 'bg-rose-lt/40 border-rose/20' }
  if (pct > 80) return { bar: 'bg-amber', text: 'text-amber', bg: 'bg-amber-lt/40 border-amber/20' }
  return              { bar: 'bg-sage',  text: 'text-sage',  bg: 'bg-surface border-border' }
}

export function Budgets() {
  // Subscribe directly to raw data — avoids stale function-selector issue
  const transactions    = useMinervaStore(s => s.transactions)
  const budgets         = useMinervaStore(s => s.budgets)
  const activeCurrency  = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay = useMinervaStore(s => s.selectInDisplayCurrency)
  const fx              = useMinervaStore(s => s.fx)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthLabel   = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Get budget for current month
  const budget     = budgets.find(b => b.month === currentMonth) ?? budgets[budgets.length - 1]
  const categories = Object.entries(budget?.categories ?? {}).filter(([, v]) => v.limit > 0)

  const toAED = (amt, cur) => {
    if (!amt) return 0
    if (cur === 'AED') return amt
    if (cur === 'USD') return amt * fx.USD_AED
    if (cur === 'INR') return amt * fx.INR_AED
    return amt
  }

  // Compute burn rate per category inline (reactive)
  const burnRate = (cat) => transactions
    .filter(t => t.category === cat && t.date.startsWith(currentMonth) && t.amount < 0 && t.type !== 'reconciliation_adjustment')
    .reduce((s, t) => s + toAED(Math.abs(t.amount), t.currency), 0)

  const totalLimit = categories.reduce((s, [, v]) => s + (v.limit ?? 0), 0)
  const totalSpent = categories.reduce((s, [cat]) => s + burnRate(cat), 0)
  const remaining  = totalLimit - totalSpent
  const overallPct = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0
  const isOver     = totalSpent > totalLimit

  const today       = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysLeft    = daysInMonth - today.getDate()
  const dailyBudget = remaining > 0 && daysLeft > 0 ? remaining / daysLeft : 0

  return (
    <div className="min-h-screen bg-alabaster pb-28">
      <div className="bg-navy px-5 pt-12 pb-5">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Budget Tracker</p>
        <p className="text-xl font-bold text-white">{monthLabel}</p>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div>
            <p className="text-[9px] font-mono text-white/35 uppercase tracking-wide">Spent</p>
            <p className="text-base font-bold font-mono text-rose-lt tabular-nums mt-0.5">
              {fmt(selectInDisplay(totalSpent), activeCurrency, { compact: true })}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-mono text-white/35 uppercase tracking-wide">Budget</p>
            <p className="text-base font-bold font-mono text-white tabular-nums mt-0.5">
              {fmt(selectInDisplay(totalLimit), activeCurrency, { compact: true })}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-mono text-white/35 uppercase tracking-wide">
              {isOver ? 'Over by' : 'Remaining'}
            </p>
            <p className={`text-base font-bold font-mono tabular-nums mt-0.5 ${isOver ? 'text-rose-lt' : 'text-sage-lt'}`}>
              {fmt(selectInDisplay(Math.abs(remaining)), activeCurrency, { compact: true })}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-rose-lt' : overallPct > 80 ? 'bg-amber' : 'bg-sage'}`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <p className="text-[9px] font-mono text-white/30">{overallPct.toFixed(0)}% used</p>
            {dailyBudget > 0 && (
              <p className="text-[9px] font-mono text-white/30">
                {fmt(selectInDisplay(dailyBudget), activeCurrency, { compact: true })}/day · {daysLeft}d left
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <OwnerFilter />
          <CurrencyToggle />
        </div>
      </div>

      <div className="px-5 mt-5 space-y-3">
        <p className="text-[10px] font-mono text-muted uppercase tracking-widest">
          Category Burn Rates · edit via +
        </p>

        {categories.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border px-4 py-10 text-center">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm font-medium text-slate">No budget set yet</p>
            <p className="text-xs text-muted font-mono mt-1">Tap + to set category limits</p>
          </div>
        ) : (
          categories.map(([cat, meta]) => {
            const spent   = burnRate(cat)
            const limit   = meta.limit ?? 0
            const pct     = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
            const over    = spent > limit && limit > 0
            const catMeta = CATEGORY_META[cat]
            const colors  = URGENCY_COLOR(pct, over)

            return (
              <div key={cat} className={`rounded-2xl border px-4 py-3 transition-all ${colors.bg}`}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl leading-none">{catMeta?.icon ?? '📦'}</span>
                    <div>
                      <p className="text-sm font-semibold text-navy">{catMeta?.label ?? cat}</p>
                      <p className="text-[10px] font-mono text-muted">
                        {fmt(selectInDisplay(spent), activeCurrency)} of {fmt(selectInDisplay(limit), activeCurrency)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-mono font-bold ${colors.text}`}>
                      {over ? 'OVER' : `${fmt(selectInDisplay(limit - spent), activeCurrency)} left`}
                    </p>
                    <p className="text-[9px] font-mono text-muted mt-0.5">{pct.toFixed(0)}%</p>
                  </div>
                </div>
                <div className="h-1.5 bg-black/8 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })
        )}

        {categories.length > 0 && totalSpent === 0 && (
          <div className="bg-blue-lt/40 border border-blue/20 rounded-2xl px-4 py-3 text-center">
            <p className="text-xs text-blue font-mono">
              No transactions logged this month — tap + on Dashboard to start
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
