// src/components/shared/SurplusEngine.jsx
// Surplus Engine — Deterministic 30-Day Projection
//
// Shows:
//   Current Running Balance   — actual position today
//   Projected Balance (+30d)  — deterministic: income - budget - commitments - planned
//   Net Surplus               — the difference, colour-coded
//   Planned Spends            — user-added what-if items that auto-update projection
//   Set Period button         — set opening balance + period start

import { useState }          from 'react'
import { useMinervaStore }   from '../../state/store.js'
import { fmt }               from '../../utils/currency.js'
import { CATEGORY_META }     from '../../theme.js'

const CATEGORIES = Object.entries(CATEGORY_META)
  .filter(([k]) => !['salary','rental','dividends'].includes(k))
  .map(([k, v]) => ({ id: k, label: v.label, icon: v.icon }))

// ─── Planned Spend Row ────────────────────────────────────────────────────────
function PlannedSpendRow({ spend, onRemove }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/8 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-sm">{CATEGORY_META[spend.category]?.icon ?? '📦'}</span>
        <div>
          <p className="text-xs text-white/80">{spend.label}</p>
          <p className="text-[9px] font-mono text-white/35">
            {new Date(spend.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-rose-lt tabular-nums">
          −{fmt(spend.amount, spend.currency)}
        </span>
        <button
          onClick={() => onRemove(spend.id)}
          className="text-white/25 text-xs hover:text-rose-lt transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── Add Planned Spend Form ───────────────────────────────────────────────────
function AddPlannedSpendForm({ onAdd, onCancel }) {
  const activeCurrency = useMinervaStore(s => s.activeCurrency)
  const [form, setForm] = useState({
    label:    '',
    amount:   '',
    currency: activeCurrency,
    date:     new Date().toISOString().slice(0, 10),
    category: 'other',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const canSave = form.label.trim() && parseFloat(form.amount) > 0

  return (
    <div className="mt-2 pt-3 border-t border-white/10 space-y-2.5">
      {/* Label */}
      <input
        type="text"
        placeholder="Label (e.g. Flight to London)"
        value={form.label}
        onChange={e => set('label', e.target.value)}
        autoFocus
        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-xs font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-white/40"
      />

      {/* Amount + currency */}
      <div className="flex gap-2">
        <select
          value={form.currency}
          onChange={e => set('currency', e.target.value)}
          className="bg-white/10 border border-white/20 rounded-xl px-2 py-2 text-xs font-mono text-white focus:outline-none w-20 flex-shrink-0"
        >
          {['AED','USD','INR','SGD'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="number"
          placeholder="Amount"
          value={form.amount}
          onChange={e => set('amount', e.target.value)}
          className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-xs font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-white/40 tabular-nums"
        />
      </div>

      {/* Date + category */}
      <div className="flex gap-2">
        <input
          type="date"
          value={form.date}
          onChange={e => set('date', e.target.value)}
          className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-xs font-mono text-white focus:outline-none"
        />
        <select
          value={form.category}
          onChange={e => set('category', e.target.value)}
          className="bg-white/10 border border-white/20 rounded-xl px-2 py-2 text-xs font-mono text-white focus:outline-none flex-1"
        >
          {CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-xl text-xs font-mono text-white/40 border border-white/15"
        >
          Cancel
        </button>
        <button
          onClick={() => canSave && onAdd(form)}
          disabled={!canSave}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
            canSave ? 'bg-blue text-white active:scale-95' : 'bg-white/10 text-white/25 cursor-not-allowed'
          }`}
        >
          Add Spend
        </button>
      </div>
    </div>
  )
}

// ─── Main Card ────────────────────────────────────────────────────────────────
export function SurplusEngine() {
  const selectDeterministicProjection = useMinervaStore(s => s.selectDeterministicProjection)
  const addPlannedSpend               = useMinervaStore(s => s.addPlannedSpend)
  const removePlannedSpend            = useMinervaStore(s => s.removePlannedSpend)
  const plannedSpends                 = useMinervaStore(s => s.plannedSpends)
  const setInitialBalance             = useMinervaStore(s => s.setInitialBalance)
  const setPeriodStart                = useMinervaStore(s => s.setPeriodStart)
  const initialBalance                = useMinervaStore(s => s.initialBalance)
  const periodStart                   = useMinervaStore(s => s.periodStart)
  const activeCurrency                = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay               = useMinervaStore(s => s.selectInDisplayCurrency)
  // Subscribe for reactive updates when planned spends or transactions change
  const transactions                  = useMinervaStore(s => s.transactions)

  const [showPeriodEditor, setShowPeriodEditor] = useState(false)
  const [showAddForm,      setShowAddForm]      = useState(false)
  const [inputBal,         setInputBal]         = useState('')
  const [inputDate,        setInputDate]        = useState(periodStart?.slice(0, 10) ?? '')

  const {
    currentBalance, projectedBalance, expectedIncome,
    remainingBudget, monthlyCommitments, plannedSpendTotal,
    netSurplus, isPositive,
  } = selectDeterministicProjection()

  const dispCurrent   = selectInDisplay(currentBalance)
  const dispProjected = selectInDisplay(projectedBalance)
  const dispSurplus   = selectInDisplay(Math.abs(netSurplus))
  const dispIncome    = selectInDisplay(expectedIncome)
  const dispBudget    = selectInDisplay(remainingBudget)
  const dispCommit    = selectInDisplay(monthlyCommitments)
  const dispPlanned   = selectInDisplay(plannedSpendTotal)

  const handleSavePeriod = () => {
    const parsed = parseFloat(inputBal.replace(/,/g, ''))
    if (!isNaN(parsed)) setInitialBalance(parsed, activeCurrency)
    if (inputDate)      setPeriodStart(inputDate)
    setShowPeriodEditor(false)
  }

  const handleAddSpend = (form) => {
    addPlannedSpend({
      label:    form.label,
      amount:   parseFloat(form.amount),
      currency: form.currency,
      date:     form.date,
      category: form.category,
    })
    setShowAddForm(false)
  }

  // Only show upcoming planned spends (next 30 days)
  const today    = new Date().toISOString().slice(0, 10)
  const cutoff30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10) })()
  const upcomingSpends = plannedSpends.filter(p => p.date >= today && p.date <= cutoff30)

  return (
    <div className="mx-5 mt-4 bg-navy rounded-2xl overflow-hidden">

      {/* ── Header: current + projected ────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between mb-1">
          <p className="text-[10px] font-mono text-white/35 uppercase tracking-widest">
            Surplus Engine · 30-Day Projection
          </p>
          <button
            onClick={() => {
              setInputBal(String(initialBalance))
              setInputDate(periodStart?.slice(0,10) ?? '')
              setShowPeriodEditor(e => !e)
              setShowAddForm(false)
            }}
            className="text-[9px] font-mono text-white/25 border border-white/12 rounded-lg px-2 py-1 active:bg-white/10 transition-all"
          >
            {showPeriodEditor ? 'Cancel' : '⚙ Period'}
          </button>
        </div>

        {/* Two columns: current vs projected */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <p className="text-[9px] font-mono text-white/35 uppercase tracking-wide mb-1">Now</p>
            <p className="text-2xl font-bold text-white font-mono tabular-nums leading-none">
              {fmt(dispCurrent, activeCurrency, { compact: true })}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-mono text-white/35 uppercase tracking-wide mb-1">In 30 days</p>
            <p className={`text-2xl font-bold font-mono tabular-nums leading-none ${
              isPositive ? 'text-sage-lt' : 'text-rose-lt'
            }`}>
              {fmt(dispProjected, activeCurrency, { compact: true })}
            </p>
          </div>
        </div>

        {/* Net surplus indicator */}
        <div className={`flex items-center gap-2 mt-3 px-3 py-2 rounded-xl ${
          isPositive ? 'bg-sage/15' : 'bg-rose/15'
        }`}>
          <span className={`text-base ${isPositive ? 'text-sage-lt' : 'text-rose-lt'}`}>
            {isPositive ? '▲' : '▼'}
          </span>
          <p className={`text-sm font-mono font-bold tabular-nums ${
            isPositive ? 'text-sage-lt' : 'text-rose-lt'
          }`}>
            {isPositive ? '+' : '−'}{fmt(dispSurplus, activeCurrency, { compact: false })}
          </p>
          <p className="text-[10px] font-mono text-white/35 ml-1">
            {isPositive ? 'projected surplus' : 'projected deficit'}
          </p>
        </div>

        {/* Period editor */}
        {showPeriodEditor && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
            <div>
              <p className="text-[9px] font-mono text-white/35 uppercase tracking-wide mb-1">
                Opening Balance ({activeCurrency})
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={String(initialBalance || 0)}
                  value={inputBal}
                  onChange={e => setInputBal(e.target.value)}
                  autoFocus
                  className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-xs font-mono text-white placeholder:text-white/25 focus:outline-none tabular-nums"
                />
                <button onClick={handleSavePeriod}
                  className="px-4 py-2 bg-sage text-white text-xs font-semibold rounded-xl active:scale-95">
                  Save
                </button>
              </div>
            </div>
            <div>
              <p className="text-[9px] font-mono text-white/35 uppercase tracking-wide mb-1">Period Start</p>
              <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-xs font-mono text-white focus:outline-none" />
            </div>
          </div>
        )}
      </div>

      {/* ── Breakdown ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 border-t border-white/10">
        {[
          { label: 'Income',      value: dispIncome,   sign: '+', color: 'text-sage-lt'   },
          { label: 'Budget',      value: dispBudget,   sign: '−', color: 'text-rose-lt/80' },
          { label: 'Fixed',       value: dispCommit,   sign: '−', color: 'text-rose-lt/80' },
          { label: 'Planned',     value: dispPlanned,  sign: '−', color: plannedSpendTotal > 0 ? 'text-amber' : 'text-white/25' },
        ].map((s, i) => (
          <div key={s.label} className={`px-3 py-2.5 ${i < 3 ? 'border-r border-white/10' : ''}`}>
            <p className="text-[8px] font-mono text-white/30 uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-[11px] font-mono font-semibold tabular-nums ${s.color}`}>
              {s.sign}{fmt(s.value, activeCurrency, { compact: true })}
            </p>
          </div>
        ))}
      </div>

      {/* ── Planned Spends ─────────────────────────────────────────────────── */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-mono text-white/35 uppercase tracking-widest">
            Planned Spends
            {upcomingSpends.length > 0 && (
              <span className="ml-2 text-amber">{upcomingSpends.length}</span>
            )}
          </p>
          <button
            onClick={() => { setShowAddForm(f => !f); setShowPeriodEditor(false) }}
            className="text-[10px] font-mono text-blue border border-blue/30 rounded-lg px-2.5 py-1 active:bg-blue/10 transition-all"
          >
            {showAddForm ? 'Cancel' : '+ Add'}
          </button>
        </div>

        {/* Planned spend list */}
        {upcomingSpends.length > 0 && !showAddForm && (
          <div>
            {upcomingSpends.map(spend => (
              <PlannedSpendRow
                key={spend.id}
                spend={spend}
                onRemove={removePlannedSpend}
              />
            ))}
          </div>
        )}

        {upcomingSpends.length === 0 && !showAddForm && (
          <p className="text-[10px] font-mono text-white/20 text-center py-2">
            No planned spends — tap + Add to model a future purchase
          </p>
        )}

        {/* Add form */}
        {showAddForm && (
          <AddPlannedSpendForm
            onAdd={handleAddSpend}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </div>
    </div>
  )
}
