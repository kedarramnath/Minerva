// src/modules/Reconciliation/OpeningBalances.jsx
// Step 1 of making Minerva operational:
// User enters the closing balance from their most recent bank statement per account.
// This becomes the reconciledBalance anchor — the starting point for live drift tracking.
//
// UX RULES:
//   - Grouped by country, ordered UAE → India → USA → Singapore
//   - Non-liquid accounts (investments, FDs, pensions) shown separately — still need anchoring
//   - Credit cards shown with label "Amount Owed" so sign is unambiguous
//   - Inline save per row — no giant Save All button
//   - Green dot once anchored, amber dot if still at 0 with no reconciledAt

import { useState, useRef } from 'react'
import { useMinervaStore }   from '../../state/store.js'
import { fmt }               from '../../utils/currency.js'
import { COUNTRY_FLAGS }     from '../../theme.js'

const COUNTRY_ORDER = ['UAE', 'India', 'USA', 'Singapore']

const ACCOUNT_TYPE_LABEL = {
  current:       'Current',
  savings:       'Savings',
  credit_card:   'Credit Card',
  investment:    'Investment',
  fixed_deposit: 'Fixed Deposit',
  pension:       'Pension / DEWS',
}

export function OpeningBalances({ onDone }) {
  const accounts = useMinervaStore(s => s.accounts)
  const reconcile = useMinervaStore(s => s.reconcile)

  // Local input state: { [accountId]: { value: string, month: string, saved: bool } }
  const [inputs, setInputs] = useState(() =>
    Object.fromEntries(
      accounts.map(a => [a.id, {
        value: a.reconciledBalance > 0 ? String(a.reconciledBalance) : '',
        month: a.reconciledAt?.slice(0, 7) ?? new Date().toISOString().slice(0, 7),
        saved: a.reconciledBalance > 0 && !!a.reconciledAt,
      }])
    )
  )

  const setField = (id, field, val) =>
    setInputs(s => ({ ...s, [id]: { ...s[id], [field]: val, saved: false } }))

  const handleSave = (account) => {
    const { value, month } = inputs[account.id]
    const parsed = parseFloat(value.replace(/,/g, ''))
    if (isNaN(parsed)) return

    // Use reconcile() — sets reconciledBalance + reconciledAt, computes drift (0 for opening)
    reconcile(account.id, parsed, month, { lockedBy: 'Kedar', note: 'Opening balance entry.' })

    setInputs(s => ({ ...s, [account.id]: { ...s[account.id], saved: true } }))
  }

  const handleSaveAll = () => {
    accounts.forEach(a => {
      const inp = inputs[a.id]
      if (!inp.saved && inp.value) handleSave(a)
    })
  }

  // Group accounts by country
  const byCountry = accounts.reduce((g, a) => {
    if (!g[a.country]) g[a.country] = []
    g[a.country].push(a)
    return g
  }, {})

  const totalSaved   = accounts.filter(a => inputs[a.id]?.saved).length
  const totalAccounts = accounts.length
  const allDone      = totalSaved === totalAccounts

  return (
    <div className="min-h-screen bg-alabaster pb-32">

      {/* Header */}
      <div className="bg-navy px-5 pt-12 pb-6">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">
          Setup · Step 1 of 1
        </p>
        <h1 className="text-xl font-bold text-white tracking-tight">Opening Balances</h1>
        <p className="text-xs text-white/50 font-mono mt-1.5 leading-relaxed">
          Enter the closing balance from your most recent bank statement for each account.
          This anchors the live tracking engine.
        </p>

        {/* Progress */}
        <div className="mt-4 bg-white/8 rounded-xl p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
              Accounts anchored
            </span>
            <span className="text-sm font-mono font-semibold text-white">
              {totalSaved} / {totalAccounts}
            </span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-sage rounded-full transition-all duration-500"
              style={{ width: `${(totalSaved / totalAccounts) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Country sections */}
      {COUNTRY_ORDER.map(country => {
        const accts = byCountry[country]
        if (!accts?.length) return null
        return (
          <div key={country} className="mt-5 px-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{COUNTRY_FLAGS[country]}</span>
              <span className="text-xs font-mono text-muted uppercase tracking-widest">
                {country}
              </span>
            </div>

            <div className="space-y-2">
              {accts.map(account => (
                <AccountBalanceRow
                  key={account.id}
                  account={account}
                  input={inputs[account.id]}
                  onChangeValue={v => setField(account.id, 'value', v)}
                  onChangeMonth={m => setField(account.id, 'month', m)}
                  onSave={() => handleSave(account)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Save All + Done */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border px-5 py-4 space-y-2">
        {!allDone && (
          <button
            onClick={handleSaveAll}
            className="w-full py-3 bg-navy/10 text-navy text-sm font-semibold rounded-2xl border border-navy/15 active:scale-[0.98] transition-all"
          >
            Save All Filled
          </button>
        )}
        <button
          onClick={onDone}
          className={`w-full py-3.5 text-white text-sm font-semibold rounded-2xl active:scale-[0.98] transition-all
            ${allDone ? 'bg-sage' : 'bg-navy'}`}
        >
          {allDone ? '✓ All Anchored — Go to Dashboard' : 'Done — Go to Dashboard'}
        </button>
      </div>
    </div>
  )
}

// ─── Single account row ────────────────────────────────────────────────────────

function AccountBalanceRow({ account, input, onChangeValue, onChangeMonth, onSave }) {
  const inputRef  = useRef(null)
  const isSaved   = input?.saved ?? false
  const isCC      = account.type === 'credit_card'
  const hasValue  = (input?.value ?? '').trim().length > 0

  const balanceLabel = isCC ? 'Amount Owed' : 'Closing Balance'

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all
      ${isSaved
        ? 'bg-sage-lt/40 border-sage/25'
        : 'bg-surface border-border'
      }`}
    >
      {/* Account identity row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          {/* Anchor status dot */}
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isSaved ? 'bg-sage' : 'bg-amber'
          }`} />
          <div>
            <p className="text-sm font-semibold text-navy leading-tight">{account.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-muted">
                {ACCOUNT_TYPE_LABEL[account.type] ?? account.type}
              </span>
              <span className="text-[10px] font-mono text-muted/60">{account.currency}</span>
              {account.notes && (
                <span className="text-[10px] text-muted/50 truncate max-w-[140px]">
                  · {account.notes.split('.')[0]}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Saved badge */}
        {isSaved && (
          <span className="text-[10px] font-mono text-sage font-semibold flex-shrink-0">
            ✓ {fmt(parseFloat(input.value.replace(/,/g, '')), account.currency)}
          </span>
        )}
      </div>

      {/* Input row — always visible so user can correct */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex gap-2">
          {/* Month picker */}
          <div className="flex-shrink-0">
            <p className="text-[9px] font-mono text-muted uppercase tracking-wide mb-1">
              Statement month
            </p>
            <input
              type="month"
              value={input?.month ?? ''}
              onChange={e => onChangeMonth(e.target.value)}
              className="text-xs font-mono text-slate bg-alabaster border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-blue transition-colors"
            />
          </div>

          {/* Balance input */}
          <div className="flex-1">
            <p className="text-[9px] font-mono text-muted uppercase tracking-wide mb-1">
              {balanceLabel} ({account.currency})
            </p>
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                type="number"
                placeholder="0.00"
                value={input?.value ?? ''}
                onChange={e => onChangeValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && hasValue) onSave() }}
                className="flex-1 min-w-0 text-sm font-mono text-slate bg-alabaster border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-blue transition-colors tabular-nums"
              />
              <button
                onClick={onSave}
                disabled={!hasValue}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95
                  ${hasValue
                    ? isSaved
                      ? 'bg-sage text-white'
                      : 'bg-navy text-white'
                    : 'bg-alabaster text-muted border border-border cursor-not-allowed'
                  }`}
              >
                {isSaved ? '✓' : 'Set'}
              </button>
            </div>
          </div>
        </div>

        {/* CC sign reminder */}
        {isCC && (
          <p className="text-[10px] font-mono text-amber">
            ↑ Enter what you owe (positive number). Payments will reduce this.
          </p>
        )}
      </div>
    </div>
  )
}
