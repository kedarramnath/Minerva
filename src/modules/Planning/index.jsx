import { useMinervaStore }       from '../../state/store.js'
import { fmt }                   from '../../utils/currency.js'
import { daysUntil, formatDate } from '../../utils/dates.js'
import { CurrencyToggle }        from '../../components/shared/CurrencyToggle.jsx'

const DEADLINE_COLOR = (days) => {
  if (days < 0)  return { text: 'text-muted', bg: 'bg-border',   label: 'Overdue' }
  if (days < 30) return { text: 'text-rose',  bg: 'bg-rose-lt',  label: `${days}d` }
  if (days < 90) return { text: 'text-amber', bg: 'bg-amber-lt', label: `${days}d` }
  return               { text: 'text-sage',  bg: 'bg-sage-lt',  label: `${days}d` }
}

const CATEGORY_ICON = {
  investment: '📈', net_worth: '💎', property: '🏠', savings: '💰', other: '🎯',
}

export function Planning() {
  // Subscribe directly to raw data
  const targets         = useMinervaStore(s => s.targets)
  const activeCurrency  = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay = useMinervaStore(s => s.selectInDisplayCurrency)

  // Compute FCNR days inline
  const fcnrDays = (() => {
    const mat = new Date('2026-08-28')
    const now = new Date(); now.setHours(0,0,0,0)
    return Math.max(0, Math.ceil((mat - now) / 86400000))
  })()
  const fcnrAED = 318611 * 3.6725

  const milestones     = targets.filter(t => t.milestoneType === 'milestone')
  const numericTargets = targets.filter(t => t.milestoneType !== 'milestone')
  const completedMilestones = milestones.filter(t => t.currentProgress > 0).length

  return (
    <div className="min-h-screen bg-alabaster pb-28">
      <div className="bg-navy px-5 pt-12 pb-5">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Planning & Targets</p>
        <p className="text-xl font-bold text-white">Financial Milestones</p>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div>
            <p className="text-[9px] font-mono text-white/35 uppercase tracking-wide">Targets</p>
            <p className="text-base font-bold text-white font-mono mt-0.5">{numericTargets.length}</p>
          </div>
          <div>
            <p className="text-[9px] font-mono text-white/35 uppercase tracking-wide">Milestones</p>
            <p className="text-base font-bold text-white font-mono mt-0.5">{completedMilestones}/{milestones.length}</p>
          </div>
          <div>
            <p className="text-[9px] font-mono text-white/35 uppercase tracking-wide">FCNR</p>
            <p className="text-base font-bold text-teal font-mono mt-0.5 tabular-nums">{fcnrDays}d</p>
          </div>
        </div>

        <div className="mt-4"><CurrencyToggle /></div>
      </div>

      <div className="px-5 mt-5 space-y-5">

        {/* FCNR hero */}
        <div className="bg-gradient-to-br from-teal to-navy rounded-2xl p-4 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9px] font-mono text-white/45 uppercase tracking-widest mb-1">
                Key Milestone · Confirmed
              </p>
              <p className="text-base font-bold">FCNR Deposit Maturity</p>
              <p className="text-2xl font-bold font-mono tabular-nums mt-1">{fcnrDays} days</p>
              <p className="text-xs text-white/55 font-mono mt-1">
                28 Aug 2026 · Net {fmt(selectInDisplay(fcnrAED), activeCurrency, { compact: true })}
              </p>
            </div>
            <div className="w-14 h-14 rounded-full border-2 border-white/20 flex items-center justify-center flex-shrink-0">
              <div className="text-center">
                <p className="text-[10px] font-mono text-white/50">days</p>
                <p className="text-sm font-bold font-mono tabular-nums">{fcnrDays}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Numeric targets */}
        {numericTargets.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-3">
              Active Targets · update via +
            </p>
            <div className="space-y-3">
              {numericTargets.map(t => {
                const days    = daysUntil(t.deadline)
                const pct     = t.targetAmount > 1 ? Math.min((t.currentProgress / t.targetAmount) * 100, 100) : 0
                const dc      = DEADLINE_COLOR(days)
                const catIcon = CATEGORY_ICON[t.category] ?? '🎯'

                return (
                  <div key={t.id} className="bg-surface rounded-2xl border border-border p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-2.5 flex-1 mr-3">
                        <span className="text-lg leading-none mt-0.5">{catIcon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-navy leading-tight">{t.title}</p>
                          <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{t.description}</p>
                        </div>
                      </div>
                      <div className={`flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-mono font-semibold ${dc.text} ${dc.bg}`}>
                        {dc.label}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono text-muted">
                        <span>{fmt(selectInDisplay(t.currentProgress), activeCurrency)} achieved</span>
                        <span>{fmt(selectInDisplay(t.targetAmount), activeCurrency)} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-alabaster rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-sage' : pct > 60 ? 'bg-blue' : 'bg-navy/40'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[9px] font-mono text-muted">Due {formatDate(t.deadline, 'medium')}</p>
                      {pct >= 100 && <span className="text-[9px] font-mono text-sage font-semibold">✓ Achieved</span>}
                    </div>
                    {t.notes && (
                      <p className="text-[9px] text-muted mt-1.5 leading-relaxed border-t border-border pt-1.5">{t.notes}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-3">Milestones</p>
            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
              {milestones.map((t, i) => {
                const days = daysUntil(t.deadline)
                const done = t.currentProgress > 0
                const dc   = DEADLINE_COLOR(days)
                return (
                  <div key={t.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i < milestones.length - 1 ? 'border-b border-border/60' : ''}`}
                  >
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${done ? 'bg-sage text-white' : 'bg-alabaster border-2 border-border'}`}>
                      {done ? '✓' : ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${done ? 'text-muted line-through' : 'text-slate'}`}>{t.title}</p>
                      <p className="text-[9px] font-mono text-muted mt-0.5">Due {formatDate(t.deadline, 'short')}</p>
                    </div>
                    <span className={`flex-shrink-0 text-[9px] font-mono font-semibold px-2 py-0.5 rounded-lg ${dc.text} ${dc.bg}`}>
                      {done ? 'Done' : dc.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {targets.length === 0 && (
          <div className="bg-surface rounded-2xl border border-border px-4 py-10 text-center">
            <p className="text-2xl mb-2">🎯</p>
            <p className="text-sm font-medium text-slate">No targets yet</p>
            <p className="text-xs text-muted font-mono mt-1">Tap + to add your first financial goal</p>
          </div>
        )}

        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-muted/40" />
          <p className="text-[10px] font-mono text-muted/60">Tap + to log milestone progress or add a new target</p>
        </div>
      </div>
    </div>
  )
}
