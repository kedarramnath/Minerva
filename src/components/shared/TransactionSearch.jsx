// src/components/shared/TransactionSearch.jsx
// Search + Tag filter for transactions
// Used in the Activity tab — filters the recent transaction list
// by merchant name, date, or category tag

import { useState, useMemo } from 'react'
import { useMinervaStore }   from '../../state/store.js'
import { fmt }               from '../../utils/currency.js'
import { CATEGORY_META }     from '../../theme.js'

const TAGS = [
  { id: 'groceries',     label: 'Groceries',  icon: '🛒' },
  { id: 'dining',        label: 'Dining',     icon: '🍽️' },
  { id: 'travel',        label: 'Travel',     icon: '✈️' },
  { id: 'utilities',     label: 'Utilities',  icon: '💡' },
  { id: 'medical',       label: 'Medical',    icon: '🏥' },
  { id: 'school',        label: 'School',     icon: '📚' },
  { id: 'entertainment', label: 'Fun',        icon: '🎬' },
  { id: 'household',     label: 'Household',  icon: '🏠' },
]

export function TransactionSearch() {
  const transactions    = useMinervaStore(s => s.transactions)
  const activeCurrency  = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay = useMinervaStore(s => s.selectInDisplayCurrency)
  const fx              = useMinervaStore(s => s.fx)

  const [query,       setQuery]       = useState('')
  const [activeTags,  setActiveTags]  = useState([])
  const [dateFilter,  setDateFilter]  = useState('')  // 'YYYY-MM'

  const toAED = (amt, cur) => {
    if (cur === 'AED') return amt
    if (cur === 'USD') return amt * fx.USD_AED
    if (cur === 'INR') return amt * fx.INR_AED
    if (cur === 'SGD') return amt * fx.SGD_AED
    return amt
  }

  const toggleTag = (id) => {
    setActiveTags(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  const filtered = useMemo(() => {
    return [...transactions]
      .filter(t => t.type !== 'reconciliation_adjustment')
      .filter(t => {
        // Text search — merchant name or description
        if (query.trim()) {
          const q = query.toLowerCase()
          const desc = (t.description ?? '').toLowerCase()
          const cat  = (t.category ?? '').toLowerCase()
          if (!desc.includes(q) && !cat.includes(q)) return false
        }
        // Date filter
        if (dateFilter && !t.date.startsWith(dateFilter)) return false
        // Tag filter
        if (activeTags.length > 0 && !activeTags.includes(t.category)) return false
        return true
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 50)
  }, [transactions, query, activeTags, dateFilter])

  const totalFiltered = filtered.reduce((s, t) =>
    s + toAED(t.amount, t.currency), 0
  )

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-2">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none select-none">⌕</span>
        <input
          type="search"
          placeholder="Search merchant or description…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 rounded-2xl border border-border bg-surface text-sm text-slate focus:outline-none focus:border-blue transition-colors font-mono placeholder:text-muted/60"
        />
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted text-xs">✕</button>
        )}
      </div>

      {/* Date filter + result count */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="month"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="text-[11px] font-mono text-slate bg-surface border border-border rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue"
        />
        {dateFilter && (
          <button onClick={() => setDateFilter('')}
            className="text-[10px] font-mono text-muted border border-border rounded-xl px-2 py-1.5">
            Clear
          </button>
        )}
        <span className="text-[10px] font-mono text-muted ml-auto">
          {filtered.length} txn · {totalFiltered >= 0 ? '+' : ''}{fmt(selectInDisplay(toAED(totalFiltered, 'AED')), activeCurrency, { compact: true })}
        </span>
      </div>

      {/* Tag pills */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {TAGS.map(tag => {
          const active = activeTags.includes(tag.id)
          return (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium border transition-all active:scale-95 ${
                active
                  ? 'bg-navy text-white border-navy'
                  : 'bg-surface text-muted border-border'
              }`}
            >
              <span className="text-xs">{tag.icon}</span>
              {tag.label}
            </button>
          )
        })}
        {activeTags.length > 0 && (
          <button
            onClick={() => setActiveTags([])}
            className="px-2.5 py-1 rounded-full text-[10px] font-mono text-rose border border-rose/30 bg-rose-lt/30"
          >
            Clear tags
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border px-4 py-8 text-center">
          <p className="text-xs text-muted">No transactions match.</p>
          {(query || activeTags.length > 0 || dateFilter) && (
            <button
              onClick={() => { setQuery(''); setActiveTags([]); setDateFilter('') }}
              className="text-[10px] font-mono text-blue mt-2 underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {filtered.map((txn, i) => {
            const catMeta   = CATEGORY_META[txn.category]
            const isPos     = txn.amount > 0
            const display   = selectInDisplay(toAED(txn.amount, txn.currency))
            const dateLabel = new Date(txn.date).toLocaleDateString('en-GB', {
              day: '2-digit', month: 'short'
            })
            return (
              <div
                key={txn.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < filtered.length - 1 ? 'border-b border-border/50' : ''
                }`}
              >
                <span className="text-base flex-shrink-0 w-5 text-center">
                  {catMeta?.icon ?? '📦'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate truncate">
                    {txn.description || catMeta?.label || txn.category}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-mono text-muted">{dateLabel}</span>
                    {txn.status === 'reconciled' && (
                      <span className="text-[9px] font-mono text-sage">✓</span>
                    )}
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                      catMeta ? 'bg-alabaster text-muted' : 'bg-alabaster text-muted'
                    }`}>
                      {catMeta?.label ?? txn.category}
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-mono font-semibold tabular-nums flex-shrink-0 ${
                  isPos ? 'text-sage' : 'text-rose'
                }`}>
                  {isPos ? '+' : ''}{fmt(display, activeCurrency)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
