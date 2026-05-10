import { useMinervaStore } from '../../state/store.js'
import { fmt, daysUntil, formatDate } from '../../utils/currency.js'
import { Card, SectionHeader } from '../../components/shared/Card.jsx'

export function Planning() {
  const targets          = useMinervaStore(s => s.targets)
  const activeCurrency   = useMinervaStore(s => s.activeCurrency)
  const getFCNRCountdown = useMinervaStore(s => s.getFCNRCountdown)
  const fcnrDays         = getFCNRCountdown()
  return (
    <div className="pb-4 space-y-4">
      <div className="bg-navy px-4 pt-12 pb-5">
        <p className="text-[11px] font-mono text-white/50 uppercase tracking-widest mb-1">Planning & Targets</p>
        <p className="text-xl font-bold text-white">Financial Milestones</p>
        <p className="text-xs text-white/50 font-mono mt-1">6-month rolling targets · Updated Jan & Jul</p>
      </div>
      <div className="px-4 space-y-3">
        <div className="bg-gradient-to-br from-teal to-navy rounded-2xl p-4 text-white">
          <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Key Milestone</p>
          <p className="text-base font-bold mt-1">FCNR Deposit Maturity</p>
          <div className="flex items-end justify-between mt-2">
            <div>
              <p className="text-2xl font-bold font-mono">{fcnrDays} days</p>
              <p className="text-xs text-white/60 font-mono">28 Aug 2026 · Net USD 318,611</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/60 font-mono">Axis Bank FD</p>
              <p className="text-xs text-white/60 font-mono">#923040089815674</p>
            </div>
          </div>
        </div>
        <SectionHeader title="Active Targets" subtitle={`${targets.length} goals`} />
        {targets.map(t => {
          const days = daysUntil(t.deadline)
          const pct  = t.targetAmount > 1 ? Math.min((t.currentProgress / t.targetAmount) * 100, 100) : (t.currentProgress > 0 ? 100 : 0)
          const isMilestone = t.milestoneType === 'milestone'
          return (
            <Card key={t.id} className="p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 mr-2">
                  <p className="text-sm font-semibold text-navy">{t.title}</p>
                  <p className="text-[10px] text-muted mt-0.5">{t.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-mono font-semibold ${days < 30 ? 'text-rose' : days < 90 ? 'text-amber' : 'text-sage'}`}>
                    {days > 0 ? `${days}d` : 'Due'}
                  </p>
                  <p className="text-[10px] font-mono text-muted">{formatDate(t.deadline, 'short')}</p>
                </div>
              </div>
              {isMilestone ? (
                <div className={`text-center py-1.5 rounded-xl text-xs font-semibold font-mono ${pct === 100 ? 'bg-sage-lt text-sage' : 'bg-alabaster text-muted'}`}>
                  {pct === 100 ? '✅ Complete' : '◌ Pending'}
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-[10px] font-mono text-muted mb-1">
                    <span>{fmt(t.currentProgress, t.currency)} achieved</span>
                    <span>{fmt(t.targetAmount, t.currency)} target · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-alabaster rounded-full overflow-hidden">
                    <div className="h-full bg-sage rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </>
              )}
              {t.notes && <p className="text-[10px] text-muted mt-2">{t.notes}</p>}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
