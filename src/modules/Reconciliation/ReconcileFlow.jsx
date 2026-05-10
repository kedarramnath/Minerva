// src/modules/Reconciliation/ReconcileFlow.jsx
// Monthly reconciliation: user provides bank-verified balance → store computes drift
// → creates adjustment transaction if needed → locks the month.
//
// FLOW:
//   Step 1 — Pick account
//   Step 2 — Enter statement balance + month
//   Step 3 — Review drift + confirm (or cancel)
//   Step 4 — Done confirmation with summary

import { useState }          from 'react'
import { useMinervaStore }   from '../../state/store.js'
import { fmt }               from '../../utils/currency.js'
import { COUNTRY_FLAGS }     from '../../theme.js'

const STEPS = { PICK: 'pick', ENTER: 'enter', REVIEW: 'review', DONE: 'done' }

export function ReconcileFlow({ onClose }) {
  const [step,       setStep]       = useState(STEPS.PICK)
  const [accountId,  setAccountId]  = useState(null)
  const [month,      setMonth]      = useState(prevMonth())
  const [rawBalance, setRawBalance] = useState('')
  const [result,     setResult]     = useState(null)  // result from store.reconcile()

  const accounts          = useMinervaStore(s => s.accounts)
  const reconcileAction   = useMinervaStore(s => s.reconcile)
  const selectLiveBalance = useMinervaStore(s => s.selectLiveBalance)
  const transactions      = useMinervaStore(s => s.transactions)

  const account       = accounts.find(a => a.id === accountId)
  const parsed        = parseFloat(rawBalance.replace(/,/g, ''))
  const trackedBalance = accountId ? selectLiveBalance(accountId) : 0
  const drift          = isNaN(parsed) ? null : parsed - trackedBalance
  const hasDrift       = drift !== null && Math.abs(drift) > 0.001

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePickAccount = (id) => {
    setAccountId(id)
    // Pre-fill month from account's last reconciliation
    const acct = accounts.find(a => a.id === id)
    if (acct?.reconciledAt) {
      setMonth(acct.reconciledAt.slice(0, 7))
    }
    setStep(STEPS.ENTER)
  }

  const handleReview = () => {
    if (isNaN(parsed)) return
    setStep(STEPS.REVIEW)
  }

  const handleConfirm = () => {
    const res = reconcileAction(accountId, parsed, month, { lockedBy: 'Kedar' })
    setResult(res)
    setStep(STEPS.DONE)
  }

  const handleReset = () => {
    setStep(STEPS.PICK)
    setAccountId(null)
    setRawBalance('')
    setResult(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-alabaster pb-24">

      {/* Header */}
      <div className="bg-navy px-5 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-1">
          {step !== STEPS.PICK && (
            <button
              onClick={() => setStep(step === STEPS.ENTER ? STEPS.PICK : STEPS.ENTER)}
              className="text-white/50 text-sm font-mono active:text-white transition-colors"
            >
              ← Back
            </button>
          )}
          <div className="flex-1">
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
              Reconciliation
            </p>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {step === STEPS.PICK   && 'Choose Account'}
              {step === STEPS.ENTER  && (account?.shortName ?? 'Enter Balance')}
              {step === STEPS.REVIEW && 'Review Drift'}
              {step === STEPS.DONE   && 'Month Locked'}
            </h1>
          </div>
          <button onClick={onClose} className="text-white/40 text-xl font-mono leading-none active:text-white">✕</button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 mt-3">
          {[STEPS.PICK, STEPS.ENTER, STEPS.REVIEW, STEPS.DONE].map((s, i) => (
            <div key={s} className={`h-0.5 flex-1 rounded-full transition-all ${
              [STEPS.PICK, STEPS.ENTER, STEPS.REVIEW, STEPS.DONE].indexOf(step) >= i
                ? 'bg-sage'
                : 'bg-white/15'
            }`} />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="px-5 mt-5">
        {step === STEPS.PICK  && <StepPick  accounts={accounts} transactions={transactions} selectLiveBalance={selectLiveBalance} onPick={handlePickAccount} />}
        {step === STEPS.ENTER && <StepEnter account={account} month={month} rawBalance={rawBalance} parsed={parsed} trackedBalance={trackedBalance} drift={drift} hasDrift={hasDrift} onMonthChange={setMonth} onBalanceChange={setRawBalance} onNext={handleReview} />}
        {step === STEPS.REVIEW && <StepReview account={account} month={month} parsed={parsed} trackedBalance={trackedBalance} drift={drift} hasDrift={hasDrift} onConfirm={handleConfirm} onBack={() => setStep(STEPS.ENTER)} />}
        {step === STEPS.DONE  && <StepDone  result={result} account={account} month={month} parsed={parsed} onAnother={handleReset} onClose={onClose} />}
      </div>
    </div>
  )
}

// ─── Step 1: Pick Account ──────────────────────────────────────────────────────

function StepPick({ accounts, transactions, selectLiveBalance, onPick }) {
  const COUNTRY_ORDER = ['UAE', 'India', 'USA', 'Singapore']

  const pendingCounts = accounts.reduce((m, a) => {
    const count = transactions.filter(t => t.accountId === a.id && t.status === 'pending').length
    m[a.id] = count
    return m
  }, {})

  const byCountry = accounts.reduce((g, a) => {
    if (!g[a.country]) g[a.country] = []
    g[a.country].push(a)
    return g
  }, {})

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted font-mono">
        Select the account you want to reconcile against your bank statement.
      </p>

      {COUNTRY_ORDER.map(country => {
        const accts = byCountry[country]
        if (!accts?.length) return null
        return (
          <div key={country}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{COUNTRY_FLAGS[country]}</span>
              <span className="text-[10px] font-mono text-muted uppercase tracking-widest">{country}</span>
            </div>
            <div className="space-y-1.5">
              {accts.map(a => {
                const liveBalance  = selectLiveBalance(a.id)
                const pendingCount = pendingCounts[a.id] ?? 0
                const isAnchored   = !!a.reconciledAt

                return (
                  <button
                    key={a.id}
                    onClick={() => onPick(a.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-surface rounded-2xl border border-border active:scale-[0.99] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        pendingCount > 0 ? 'bg-amber' : isAnchored ? 'bg-sage' : 'bg-border'
                      }`} />
                      <div>
                        <p className="text-sm font-semibold text-navy">{a.name}</p>
                        <p className="text-[10px] font-mono text-muted mt-0.5">
                          {a.currency}
                          {isAnchored && ` · Last: ${a.reconciledAt?.slice(0, 7)}`}
                          {pendingCount > 0 && ` · ${pendingCount} pending`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-slate tabular-nums">
                        {fmt(liveBalance, a.currency)}
                      </p>
                      <p className="text-[10px] font-mono text-muted mt-0.5">tracked</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 2: Enter Balance ─────────────────────────────────────────────────────

function StepEnter({ account, month, rawBalance, parsed, trackedBalance, drift, hasDrift, onMonthChange, onBalanceChange, onNext }) {
  const isCC      = account?.type === 'credit_card'
  const hasInput  = rawBalance.trim().length > 0 && !isNaN(parsed)

  return (
    <div className="space-y-4">
      {/* Instruction */}
      <div className="bg-blue-lt/50 rounded-2xl px-4 py-3 border border-blue/15">
        <p className="text-xs text-blue font-semibold mb-1">
          {isCC ? 'Enter the outstanding balance from your statement' : 'Enter the closing balance from your bank statement'}
        </p>
        <p className="text-[11px] text-muted font-mono leading-relaxed">
          This is the verified figure from {account?.institution ?? 'the bank'}, not what Minerva currently tracks.
        </p>
      </div>

      {/* Current tracked balance */}
      <div className="bg-surface border border-border rounded-2xl px-4 py-3">
        <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">
          Minerva currently tracks
        </p>
        <p className="text-lg font-mono font-semibold text-slate tabular-nums">
          {fmt(trackedBalance, account?.currency ?? 'AED')}
        </p>
        {account?.reconciledAt && (
          <p className="text-[10px] font-mono text-muted mt-0.5">
            Last anchored: {account.reconciledAt}
          </p>
        )}
      </div>

      {/* Month */}
      <div>
        <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1.5">
          Statement Month
        </p>
        <input
          type="month"
          value={month}
          onChange={e => onMonthChange(e.target.value)}
          className="w-full px-4 py-3 text-sm font-mono text-slate bg-surface border border-border rounded-2xl focus:outline-none focus:border-blue transition-colors"
        />
      </div>

      {/* Balance input */}
      <div>
        <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1.5">
          {isCC ? 'Amount Owed' : 'Closing Balance'} ({account?.currency ?? 'AED'})
        </p>
        <input
          type="number"
          placeholder="0.00"
          value={rawBalance}
          onChange={e => onBalanceChange(e.target.value)}
          autoFocus
          className="w-full px-4 py-3.5 text-xl font-mono font-semibold text-navy bg-surface border border-border rounded-2xl focus:outline-none focus:border-blue transition-colors tabular-nums"
        />
        {isCC && (
          <p className="text-[10px] font-mono text-amber mt-1.5">
            Enter positive number = what you owe the bank.
          </p>
        )}
      </div>

      {/* Live drift preview */}
      {hasInput && drift !== null && (
        <div className={`rounded-2xl px-4 py-3 border ${
          !hasDrift
            ? 'bg-sage-lt/50 border-sage/20'
            : Math.abs(drift) < 500
              ? 'bg-amber-lt/60 border-amber/20'
              : 'bg-rose-lt/50 border-rose/20'
        }`}>
          <p className={`text-[10px] font-mono uppercase tracking-widest mb-1 ${
            !hasDrift ? 'text-sage' : Math.abs(drift) < 500 ? 'text-amber' : 'text-rose'
          }`}>
            {!hasDrift ? '✓ Perfect match — no drift' : 'Drift detected'}
          </p>
          {hasDrift && (
            <>
              <p className={`text-base font-mono font-semibold tabular-nums ${drift > 0 ? 'text-sage' : 'text-rose'}`}>
                {drift > 0 ? '+' : ''}{fmt(drift, account?.currency ?? 'AED')}
              </p>
              <p className="text-[10px] font-mono text-muted mt-1 leading-relaxed">
                {drift > 0
                  ? 'Bank has more than tracked. Likely an unlogged income or credit.'
                  : 'Bank has less than tracked. Likely an unlogged expense or bank charge.'}
                {' '}An adjustment entry will be created automatically.
              </p>
            </>
          )}
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!hasInput}
        className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]
          ${hasInput ? 'bg-navy text-white' : 'bg-alabaster text-muted border border-border cursor-not-allowed'}`}
      >
        Review &amp; Confirm →
      </button>
    </div>
  )
}

// ─── Step 3: Review Drift ──────────────────────────────────────────────────────

function StepReview({ account, month, parsed, trackedBalance, drift, hasDrift, onConfirm, onBack }) {
  return (
    <div className="space-y-4">

      <p className="text-xs text-muted font-mono leading-relaxed">
        Review the reconciliation before locking. This cannot be undone — the month will be anchored.
      </p>

      {/* Summary table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <Row label="Account"        value={account?.name} />
        <Row label="Statement month" value={month} />
        <Row label="Tracked balance" value={fmt(trackedBalance, account?.currency)} mono />
        <Row label="Your statement"  value={fmt(parsed, account?.currency)}         mono />
        <Row
          label="Drift"
          value={hasDrift
            ? `${drift > 0 ? '+' : ''}${fmt(drift, account?.currency)}`
            : '✓ None'}
          valueClass={hasDrift ? (drift > 0 ? 'text-sage font-semibold' : 'text-rose font-semibold') : 'text-sage'}
          mono
        />
      </div>

      {/* What will happen */}
      <div className="bg-alabaster rounded-2xl px-4 py-3 border border-border">
        <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">
          What will happen
        </p>
        <div className="space-y-1.5">
          <ActionItem text={`All pending transactions for ${account?.shortName} up to ${month} → marked reconciled`} />
          {hasDrift && (
            <ActionItem
              text={`Adjustment entry of ${drift > 0 ? '+' : ''}${fmt(drift, account?.currency)} created to explain the gap`}
              highlight
            />
          )}
          <ActionItem text={`New anchor: ${fmt(parsed, account?.currency)} as at ${month}`} />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold text-slate bg-alabaster border border-border active:scale-[0.98] transition-all"
        >
          ← Edit
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-white bg-sage active:scale-[0.98] transition-all"
        >
          Lock Month ✓
        </button>
      </div>
    </div>
  )
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function StepDone({ result, account, month, parsed, onAnother, onClose }) {
  if (!result) return null
  const { drift, adjustmentCreated } = result

  return (
    <div className="space-y-4 text-center">

      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-sage-lt flex items-center justify-center mx-auto text-3xl">
        ✓
      </div>

      <div>
        <p className="text-lg font-bold text-navy">{account?.shortName} locked</p>
        <p className="text-xs font-mono text-muted mt-1">{month} · {fmt(parsed, account?.currency)}</p>
      </div>

      {/* Drift summary */}
      <div className="bg-surface border border-border rounded-2xl px-4 py-3 text-left space-y-2">
        {!adjustmentCreated ? (
          <p className="text-xs font-mono text-sage">✓ Perfect reconciliation — no drift detected.</p>
        ) : (
          <>
            <p className="text-xs font-mono text-amber">
              Drift of {drift > 0 ? '+' : ''}{fmt(drift, account?.currency)} adjusted.
            </p>
            <p className="text-[11px] text-muted font-mono leading-relaxed">
              An adjustment entry has been added to the transaction log to keep your history clean.
              You can annotate it in the transaction detail.
            </p>
          </>
        )}
      </div>

      {/* Next steps */}
      <div className="space-y-2 pt-2">
        <button
          onClick={onAnother}
          className="w-full py-3 rounded-2xl text-sm font-semibold text-navy bg-blue-lt/60 border border-blue/20 active:scale-[0.98] transition-all"
        >
          Reconcile Another Account
        </button>
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white bg-navy active:scale-[0.98] transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Row({ label, value, mono, valueClass = 'text-slate' }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-xs ${mono ? 'font-mono tabular-nums' : ''} ${valueClass}`}>
        {value}
      </span>
    </div>
  )
}

function ActionItem({ text, highlight = false }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`text-xs mt-0.5 flex-shrink-0 ${highlight ? 'text-amber' : 'text-sage'}`}>
        {highlight ? '→' : '·'}
      </span>
      <p className={`text-[11px] font-mono leading-relaxed ${highlight ? 'text-amber' : 'text-muted'}`}>
        {text}
      </p>
    </div>
  )
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function prevMonth() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7)
}
