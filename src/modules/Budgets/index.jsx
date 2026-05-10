import { useMinervaStore } from '../../state/store.js'
import { fmt } from '../../utils/currency.js'
import { Card, SectionHeader } from '../../components/shared/Card.jsx'
import { CATEGORY_META } from '../../theme.js'

export function Budgets() {
  const getBurnRate      = useMinervaStore(s => s.getBurnRate)
  const getCurrentBudget = useMinervaStore(s => s.getCurrentBudget)
  const budget           = getCurrentBudget()
  const currentMonth     = new Date().toISOString().slice(0, 7)
  const monthLabel       = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const categories       = Object.entries(budget?.categories || {}).filter(([, v]) => v.limit > 0)
  const totalLimit       = categories.reduce((s, [, v]) => s + v.limit, 0)
  const totalSpent       = categories.reduce((s, [cat]) => s + getBurnRate(cat, currentMonth), 0)
  return (
    <div className="pb-4 space-y-4">
      <div className="bg-navy px-4 pt-12 pb-5">
        <p className="text-[11px] font-mono text-white/50 uppercase tracking-widest mb-1">Budget Tracker</p>
        <p className="text-xl font-bold text-white">{monthLabel}</p>
        <div className="flex gap-6 mt-3">
          <div><p className="text-xs font-mono text-white/50">Spent</p><p className="text-base font-semibold text-rose-lt font-mono">{fmt(totalSpent, 'AED', { compact: true })}</p></div>
          <div><p className="text-xs font-mono text-white/50">Budget</p><p className="text-base font-semibold text-white font-mono">{fmt(totalLimit, 'AED', { compact: true })}</p></div>
          <div><p className="text-xs font-mono text-white/50">Remaining</p>
            <p className={`text-base font-semibold font-mono ${totalLimit - totalSpent < 0 ? 'text-rose-lt' : 'text-sage-lt'}`}>
              {fmt(totalLimit - totalSpent, 'AED', { compact: true })}
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 space-y-3">
        <SectionHeader title="Category Burn Rates" />
        {categories.map(([cat, meta]) => {
          const spent = getBurnRate(cat, currentMonth)
          const limit = meta.limit
          const pct   = Math.min((spent / limit) * 100, 100)
          const over  = spent > limit
          const catMeta = CATEGORY_META[cat]
          return (
            <Card key={cat} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{catMeta?.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-slate">{catMeta?.label}</p>
                    <p className="text-[10px] font-mono text-muted">{fmt(spent, 'AED')} of {fmt(limit, 'AED')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-mono font-semibold ${over ? 'text-rose' : 'text-sage'}`}>
                    {over ? 'OVER' : `${fmt(limit - spent, 'AED')} left`}
                  </p>
                </div>
              </div>
              <div className="h-2 bg-alabaster rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${over ? 'bg-rose' : pct > 80 ? 'bg-amber' : 'bg-sage'}`} style={{ width: `${pct}%` }} />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
