// src/components/FAB/FABModal.jsx
import { useState, useRef } from 'react'
import { useMinervaStore } from '../../state/store.js'
import { parseStatement, parseStatementRows, ACCOUNT_NUMBER_MAP, detectBank } from '../../utils/statementParsers.js'
import { categoriseTransaction, recategoriseAll, CATEGORIES } from '../../utils/categoryRules.js'
import { CATEGORY_META } from '../../theme.js'


// ── Statement Import Modal ────────────────────────────────────────────────────
function StatementImportModal({ onClose }) {
  const accounts       = useMinervaStore(s => s.accounts)
  const [step, setStep]         = useState('upload')   // upload | preview | done
  const [parsed, setParsed]     = useState(null)
  const [accountId, setAccountId] = useState('')
  const [error, setError]       = useState(null)
  const [importing, setImporting] = useState(false)
  const fileRef                 = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

    if (isXlsx) {
      // Read XLSX using SheetJS
      try {
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb    = XLSX.read(buffer, { type: 'array' })
        const ws    = wb.Sheets[wb.SheetNames[0]]
        const rows  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

        const result = parseStatementRows(rows, null, file.name)
        if (result.error) { setError(result.error); return }

        // Auto-match account
        let matchedId = ACCOUNT_NUMBER_MAP[result.accountNumber] ?? ''
        if (!matchedId && result.bankName === 'ENBD') {
          matchedId = result.accountType === 'credit_card' ? 'enbd-cc-kedar' : 'enbd-current-kedar'
        }
        if (!matchedId && result.bankName === 'HSBC') {
          matchedId = result.accountType === 'credit_card' ? 'hsbc-cc-kedar' : 'hsbc-current-kedar'
        }
        if (!matchedId && result.bankName === 'Wio') {
          matchedId = result.accountType === 'credit_card' ? 'wio-cc-kedar' : 'wio-current-kedar'
        }
        setAccountId(matchedId)
        setParsed(result)
        setStep('preview')
      } catch (err) {
        setError('Failed to read Excel file: ' + err.message)
      }
    } else {
      // Read CSV as text
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target.result
        const bank = detectBank(text)
        if (!bank) {
          setError('Bank format not recognised. Supported: ADCB (CSV), ENBD (XLSX).')
          return
        }
        const result = parseStatement(text, bank)
        if (result.error) { setError(result.error); return }
        const matchedId = ACCOUNT_NUMBER_MAP[result.accountNumber] ?? ''
        setAccountId(matchedId)
        setParsed(result)
        setError(null)
        setStep('preview')
      }
      reader.readAsText(file)
    }
  }

  const handleImport = () => {
    if (!parsed || !accountId) return
    setImporting(true)

    // Bulk import transactions
    // Bulk push directly to store transactions array
    const newTxns = parsed.transactions.map((txn, i) => ({
      id:          'imp_' + Date.now() + '_' + i,
      date:        txn.date,
      accountId,
      amount:      txn.amount,
      currency:    txn.currency,
      description: txn.description,
      category:    categoriseTransaction(txn),
      loggedBy:    'Import',
      reference:   txn.reference ?? '',
      type:        'imported',
      status:      'imported',
      createdAt:   new Date().toISOString(),
    }))
    useMinervaStore.setState(s => ({ transactions: [...s.transactions, ...newTxns] }))

    // Update account reconciled balance directly
    if (parsed.closingBalance !== null && parsed.closingBalance !== undefined) {
      const closingDate = parsed.period?.split(' to ')[1] ?? new Date().toISOString().slice(0, 10)
      const accounts = useMinervaStore.getState().accounts
      useMinervaStore.setState({
        accounts: accounts.map(a =>
          a.id === accountId
            ? { ...a, reconciledBalance: parsed.closingBalance, reconciledAt: closingDate }
            : a
        )
      })
    }

    setStep('done')
    setImporting(false)
  }

  // Reconciliation check
  const reconCheck = parsed ? (() => {
    const sum = parsed.transactions.reduce((s, t) => s + t.amount, 0)
    const expected = parsed.openingBalance + sum
    const diff = Math.abs(expected - parsed.closingBalance)
    return { sum, expected, diff, ok: diff < 0.1 }
  })() : null

  const activeAccounts = accounts.filter(a => a.active)

  if (step === 'done') return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-surface rounded-t-3xl shadow-2xl p-5 pb-10 text-center">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />
        <p className="text-4xl mb-3">✅</p>
        <p className="text-base font-bold text-navy">Import Complete</p>
        <p className="text-xs font-mono text-muted mt-1">
          {parsed.transactions.length} transactions imported
        </p>
        {reconCheck && (
          <div className={`mt-4 px-4 py-2.5 rounded-xl text-xs font-mono ${reconCheck.ok ? 'bg-sage-lt text-sage' : 'bg-rose-lt text-rose'}`}>
            {reconCheck.ok
              ? '✓ Balances reconciled'
              : `⚠ Discrepancy: ${parsed.currency} ${reconCheck.diff.toFixed(2)}`
            }
          </div>
        )}
        <button onClick={() => {
          const txns = useMinervaStore.getState().transactions
          useMinervaStore.setState({ transactions: recategoriseAll(txns) })
        }}
          className="mt-3 w-full py-3 border border-border rounded-2xl text-xs font-mono text-muted">
          ↺ Re-categorise all existing transactions
        </button>
        <button onClick={onClose}
          className="mt-3 w-full py-3.5 bg-navy text-white rounded-2xl text-sm font-semibold">
          Done
        </button>
      </div>
    </div>
  )

  if (step === 'preview' && parsed) return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-surface rounded-t-3xl shadow-2xl p-5 pb-10 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
        <h3 className="text-base font-semibold text-navy mb-1">Preview Import</h3>
        <p className="text-xs font-mono text-muted mb-4">{parsed.bankName} · {parsed.accountNumber} · {parsed.currency}</p>

        {/* Reconciliation check */}
        <div className={`rounded-xl p-3 mb-4 ${reconCheck?.ok ? 'bg-sage-lt/50 border border-sage/20' : 'bg-rose-lt/50 border border-rose/20'}`}>
          <div className="flex justify-between text-[10px] font-mono mb-1">
            <span className="text-muted">Opening Balance</span>
            <span className="text-slate">{parsed.currency} {parsed.openingBalance.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono mb-1">
            <span className="text-muted">Net Transactions ({parsed.transactions.length})</span>
            <span className={reconCheck?.sum >= 0 ? 'text-sage' : 'text-rose'}>
              {reconCheck?.sum >= 0 ? '+' : ''}{parsed.currency} {reconCheck?.sum.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-[10px] font-mono mb-1 border-t border-black/8 pt-1">
            <span className="text-muted">Expected Closing</span>
            <span className="text-slate">{parsed.currency} {reconCheck?.expected.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono font-bold">
            <span className="text-muted">Statement Closing</span>
            <span className="text-slate">{parsed.currency} {parsed.closingBalance.toLocaleString()}</span>
          </div>
          <div className={`mt-2 text-center text-[10px] font-mono font-bold ${reconCheck?.ok ? 'text-sage' : 'text-rose'}`}>
            {reconCheck?.ok ? '✓ Balanced' : `⚠ Off by ${parsed.currency} ${reconCheck?.diff.toFixed(2)}`}
          </div>
        </div>

        {/* Account selector */}
        <div className="mb-4">
          <label className="block text-[11px] font-mono text-muted uppercase tracking-wide mb-1.5">
            Import into Account
          </label>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className={selectCls}
          >
            <option value="">— Select account —</option>
            {activeAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </select>
          {parsed.accountNumber && ACCOUNT_NUMBER_MAP[parsed.accountNumber] && (
            <p className="text-[9px] font-mono text-sage mt-1">✓ Auto-matched from account number</p>
          )}
        </div>

        {/* Sample transactions */}
        <div className="mb-4">
          <p className="text-[10px] font-mono text-muted uppercase tracking-wide mb-2">
            Sample Transactions (first 5)
          </p>
          <div className="bg-alabaster rounded-xl overflow-hidden border border-border">
            {parsed.transactions.slice(0, 5).map((t, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 ${i < 4 ? 'border-b border-border/50' : ''}`}>
                <span className="text-[9px] font-mono text-muted w-20 flex-shrink-0">{t.date}</span>
                <span className="text-[10px] text-slate flex-1 truncate">{t.description}</span>
                <span className={`text-[10px] font-mono font-semibold flex-shrink-0 ${t.amount >= 0 ? 'text-sage' : 'text-rose'}`}>
                  {t.amount >= 0 ? '+' : ''}{t.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setStep('upload')}
            className="flex-1 py-3 border border-border rounded-2xl text-sm text-muted font-mono">
            Back
          </button>
          <button
            onClick={handleImport}
            disabled={!accountId || importing}
            className={`flex-1 py-3 rounded-2xl text-sm font-semibold text-white transition-all ${
              accountId ? 'bg-navy active:scale-[0.98]' : 'bg-border cursor-not-allowed'
            }`}
          >
            {importing ? 'Importing…' : `Import ${parsed.transactions.length} transactions`}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <Sheet title="Import Statement" subtitle="ADCB · ENBD · HSBC · Wio Current · Wio Credit" onClose={onClose} onSubmit={() => fileRef.current?.click()} submitLabel="Choose CSV File">
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer active:bg-alabaster transition-colors"
      >
        <p className="text-3xl mb-2">📂</p>
        <p className="text-sm font-semibold text-slate">Select bank statement CSV</p>
        <p className="text-[10px] font-mono text-muted mt-1">ADCB CSV · ENBD XLSX · HSBC CSV · Wio CSV</p>
      </div>
      {error && (
        <div className="bg-rose-lt border border-rose/20 rounded-xl px-3 py-2.5">
          <p className="text-xs font-mono text-rose">{error}</p>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFile}
        className="hidden"
      />
    </Sheet>
  )
}


// ── Reconcile Modal (triggered from FAB) ──────────────────────────────────────
function ReconcileModal({ onClose }) {
  const accounts          = useMinervaStore(s => s.accounts)
  const selectLiveBalance = useMinervaStore(s => s.selectLiveBalance)
  const [accountId, setAccountId] = useState('')
  const [liveInput, setLiveInput] = useState('')
  const [step, setStep]           = useState('select') // select | input | confirm | done

  const account = accounts.find(a => a.id === accountId)
  const tracked = account ? selectLiveBalance(accountId) : 0
  const live    = parseFloat(liveInput) || 0
  const diff    = live - tracked
  const absDiff = Math.abs(diff)
  const matched = absDiff < 0.01

  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handlePost = () => {
    if (!matched) {
      const adjTxn = {
        id:          'adj_' + Date.now(),
        date:        new Date().toISOString().slice(0, 10),
        accountId,
        amount:      diff,
        currency:    account.currency,
        description: 'Reconciliation adjustment',
        category:    'other',
        type:        'reconciliation_adjustment',
        status:      'reconciled',
        loggedBy:    'Reconcile',
        createdAt:   new Date().toISOString(),
      }
      useMinervaStore.setState(s => ({ transactions: [...s.transactions, adjTxn] }))
    }
    const accts = useMinervaStore.getState().accounts
    useMinervaStore.setState({
      accounts: accts.map(a =>
        a.id === accountId
          ? { ...a, reconciledBalance: live, reconciledAt: new Date().toISOString().slice(0, 10) }
          : a
      )
    })
    setStep('done')
  }

  if (step === 'done') return (
    <Sheet title="Reconciliation" onClose={onClose} onSubmit={onClose} submitLabel="Done">
      <div className="text-center py-4">
        <p className="text-3xl mb-2">{matched ? '✅' : '⚖️'}</p>
        <p className="text-sm font-semibold text-navy">{matched ? 'Balances match' : 'Adjustment posted'}</p>
        <p className="text-xs font-mono text-muted mt-1">{account?.shortName} · {account?.currency} {fmt(live)}</p>
      </div>
    </Sheet>
  )

  if (step === 'confirm') return (
    <Sheet title="Confirm Adjustment" onClose={onClose} onSubmit={handlePost} submitLabel="Post Adjustment">
      <div className="space-y-2 bg-alabaster rounded-xl p-3 font-mono text-xs">
        <div className="flex justify-between"><span className="text-muted">Minerva balance</span><span>{account.currency} {fmt(tracked)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Live balance</span><span>{account.currency} {fmt(live)}</span></div>
        <div className="flex justify-between font-bold border-t border-border pt-2">
          <span className="text-muted">Adjustment</span>
          <span className={diff >= 0 ? 'text-sage' : 'text-rose'}>{diff >= 0 ? '+' : ''}{account.currency} {fmt(diff)}</span>
        </div>
      </div>
      <p className="text-[10px] font-mono text-muted">A single reconciliation entry will be posted.</p>
    </Sheet>
  )

  if (step === 'input') return (
    <Sheet title={`Reconcile — ${account?.shortName}`} subtitle={`Minerva: ${account?.currency} ${fmt(tracked)}`} onClose={onClose} onSubmit={() => liveInput && setStep(matched ? 'done' : 'confirm')} submitLabel="Check Balance">
      <Field label="Your actual balance right now">
        <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl border border-border bg-alabaster">
          <span className="text-xs font-mono text-muted">{account?.currency}</span>
          <input type="number" value={liveInput} onChange={e => setLiveInput(e.target.value)}
            placeholder="0.00" autoFocus className="flex-1 bg-transparent text-sm font-mono text-slate focus:outline-none" />
        </div>
      </Field>
      {liveInput && (
        <div className={`rounded-xl px-3 py-2.5 text-xs font-mono ${matched ? 'bg-sage-lt text-sage' : 'bg-amber-lt text-amber'}`}>
          {matched ? '✓ Balances match' : `Discrepancy: ${account?.currency} ${fmt(absDiff)}`}
        </div>
      )}
    </Sheet>
  )

  return (
    <Sheet title="Reconcile Account" subtitle="Update a live balance" onClose={onClose} onSubmit={() => accountId && setStep('input')} submitLabel="Next →">
      <Field label="Select Account">
        <select value={accountId} onChange={e => setAccountId(e.target.value)} className={selectCls}>
          <option value="">— Choose account —</option>
          {accounts.filter(a => a.active).map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
          ))}
        </select>
      </Field>
    </Sheet>
  )
}

export function FABModal({ context, onClose }) {
  const MODALS = {
    dashboard:    TransactionModal,
    import:       StatementImportModal,
    reconcile:    ReconcileModal,
    balancesheet: ValuationModal,
    budgets:      BudgetModal,
    planning:     MilestoneModal,
    documents:    DocumentModal,
  }
  const Modal = MODALS[context] || TransactionModal
  return <Modal onClose={onClose} />
}

// ── Shared sheet wrapper ───────────────────────────────────────────────────────
function Sheet({ title, subtitle, children, onClose, onSubmit, submitLabel = 'Save', submitColor = 'bg-navy' }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      <div className="bg-surface rounded-t-3xl shadow-2xl p-5 pb-10 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
        <div className="mb-4">
          <h3 className="text-base font-semibold text-navy">{title}</h3>
          {subtitle && <p className="text-xs text-muted font-mono mt-0.5">{subtitle}</p>}
        </div>
        <div className="space-y-3">
          {children}
        </div>
        <button
          onClick={onSubmit}
          className={`mt-5 w-full py-3.5 ${submitColor} text-white rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]`}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-mono text-muted uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-border bg-alabaster text-sm text-slate font-mono focus:outline-none focus:border-blue transition-colors"
const selectCls = `${inputCls} appearance-none`

// ── Invoice capture threshold (AED equivalent) ────────────────────────────────
const INVOICE_THRESHOLD_AED = 500

function toAEDEquiv(amount, currency, fx) {
  if (!amount || isNaN(amount)) return 0
  if (currency === 'AED') return amount
  if (currency === 'USD') return amount * (fx?.USD_AED ?? 3.6725)
  if (currency === 'INR') return amount * (fx?.INR_AED ?? 0.04275)
  if (currency === 'SGD') return amount * (fx?.SGD_AED ?? 2.73)
  return amount
}

// ── Transaction Modal ──────────────────────────────────────────────────────────
function TransactionModal({ onClose }) {
  const accounts       = useMinervaStore(s => s.accounts)
  const addTransaction = useMinervaStore(s => s.addTransaction)
  const fx             = useMinervaStore(s => s.fx)
  const fileInputRef   = useRef(null)

  const [form, setForm] = useState({
    date:        new Date().toISOString().slice(0, 10),
    accountId:   'adcb-consolidated-kedar',
    amount:      '',
    isExpense:   true,
    currency:    'AED',
    category:    'groceries',
    description: '',
    loggedBy:    'Kedar',
  })
  const [invoicePhoto, setInvoicePhoto]   = useState(null)   // base64 data URL
  const [invoiceSkipped, setInvoiceSkipped] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Check if invoice is required
  const parsedAmt   = parseFloat(form.amount)
  const aedEquiv    = toAEDEquiv(parsedAmt, form.currency, fx)
  const needsInvoice = form.isExpense && !isNaN(parsedAmt) && aedEquiv >= INVOICE_THRESHOLD_AED
  const invoiceDone  = !needsInvoice || invoicePhoto || invoiceSkipped

  const handlePhotoCapture = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setInvoicePhoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = () => {
    if (!form.amount || !form.accountId) return
    if (!invoiceDone) {
      // Scroll to invoice section — handled by UI state
      fileInputRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    const amt = parseFloat(form.amount)
    addTransaction({
      ...form,
      amount:       form.isExpense ? -Math.abs(amt) : Math.abs(amt),
      invoicePhoto: invoicePhoto ?? null,
      invoiceSkipped: invoiceSkipped ?? false,
    })
    onClose()
  }

  const activeAccounts = accounts.filter(a => a.active && !['credit_card'].includes(a.type))

  return (
    <Sheet
      title="Log Transaction"
      subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={needsInvoice && !invoiceDone ? 'Add Invoice to Continue' : 'Log Transaction'}
      submitColor={needsInvoice && !invoiceDone ? 'bg-amber' : 'bg-navy'}
    >
      {/* Expense / Income toggle */}
      <div className="flex gap-2">
        {[true, false].map(isExp => (
          <button
            key={String(isExp)}
            onClick={() => { set('isExpense', isExp); setInvoicePhoto(null); setInvoiceSkipped(false) }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${form.isExpense === isExp
                ? isExp ? 'bg-rose-lt text-rose border border-rose/30' : 'bg-sage-lt text-sage border border-sage/30'
                : 'bg-alabaster text-muted border border-border'
              }`}
          >
            {isExp ? '↑ Expense' : '↓ Income'}
          </button>
        ))}
      </div>

      {/* Amount — large prominent input */}
      <Field label="Amount">
        <input
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={form.amount}
          onChange={e => { set('amount', e.target.value); setInvoicePhoto(null); setInvoiceSkipped(false) }}
          autoFocus
          className="w-full px-4 py-4 rounded-xl border-2 border-border bg-alabaster text-2xl font-mono font-bold text-navy text-center focus:outline-none focus:border-blue transition-colors tabular-nums"
        />
        {/* Currency pills */}
        <div className="flex gap-1.5 mt-2">
          {['AED', 'USD', 'INR', 'SGD'].map(c => (
            <button
              key={c}
              onClick={() => { set('currency', c); setInvoicePhoto(null); setInvoiceSkipped(false) }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                form.currency === c ? 'bg-navy text-white' : 'bg-alabaster text-muted border border-border'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        {/* AED equivalent hint when non-AED currency */}
        {form.currency !== 'AED' && !isNaN(parsedAmt) && parsedAmt > 0 && (
          <p className="text-[10px] font-mono text-muted text-center mt-1.5">
            ≈ AED {toAEDEquiv(parsedAmt, form.currency, fx).toLocaleString('en-AE', { maximumFractionDigits: 0 })}
          </p>
        )}
      </Field>

      {/* Account */}
      <Field label="Account">
        <select value={form.accountId} onChange={e => set('accountId', e.target.value)} className={selectCls}>
          {activeAccounts.map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
          ))}
        </select>
      </Field>

      {/* Category */}
      <Field label="Category">
        <div className="grid grid-cols-4 gap-1.5">
          {Object.entries(CATEGORY_META)
            .filter(([k]) => !['transfers','investments','salary','rental','dividends'].includes(k))
            .map(([key, meta]) => (
              <button
                key={key}
                onClick={() => set('category', key)}
                className={`flex flex-col items-center justify-center py-2 rounded-xl border text-center transition-all
                  ${form.category === key ? 'bg-navy text-white border-navy' : 'bg-alabaster text-muted border-border'}`}
              >
                <span className="text-base">{meta.icon}</span>
                <span className="text-[9px] font-mono mt-0.5 leading-tight">{meta.label.split(' ')[0]}</span>
              </button>
            ))}
        </div>
      </Field>

      {/* Description */}
      <Field label="Description (optional)">
        <input
          type="text"
          placeholder="e.g. Carrefour, Noon, Emirates ticket…"
          value={form.description}
          onChange={e => set('description', e.target.value)}
          className={inputCls}
        />
      </Field>

      {/* Date + Logged by */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date">
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Logged by">
          <select value={form.loggedBy} onChange={e => set('loggedBy', e.target.value)} className={selectCls}>
            <option>Kedar</option>
            <option>Anisha</option>
          </select>
        </Field>
      </div>

      {/* ── Invoice capture — appears when amount ≥ AED 500 equivalent ─────── */}
      {needsInvoice && (
        <div ref={fileInputRef} className={`rounded-2xl border-2 p-4 transition-all ${
          invoicePhoto
            ? 'border-sage/40 bg-sage-lt/30'
            : invoiceSkipped
              ? 'border-amber/30 bg-amber-lt/30'
              : 'border-amber/50 bg-amber-lt/40'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🧾</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber">
                Invoice required — expense ≥ AED {INVOICE_THRESHOLD_AED.toLocaleString()}
              </p>
              <p className="text-[10px] font-mono text-muted mt-0.5">
                {form.currency !== 'AED'
                  ? `${form.amount} ${form.currency} ≈ AED ${Math.round(aedEquiv).toLocaleString()}`
                  : `AED ${parsedAmt.toLocaleString()}`
                }
              </p>
            </div>
            {invoicePhoto && <span className="text-sage text-sm">✓</span>}
          </div>

          {/* Preview captured photo */}
          {invoicePhoto && (
            <div className="relative mb-3">
              <img
                src={invoicePhoto}
                alt="Invoice"
                className="w-full h-36 object-cover rounded-xl border border-sage/30"
              />
              <button
                onClick={() => setInvoicePhoto(null)}
                className="absolute top-2 right-2 bg-navy/70 text-white text-xs rounded-lg px-2 py-1"
              >
                Retake
              </button>
            </div>
          )}

          {!invoicePhoto && (
            <div className="space-y-2">
              {/* Camera capture — opens native camera on iPhone */}
              <button
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.capture = 'environment'  // rear camera
                  input.onchange = handlePhotoCapture
                  input.click()
                }}
                className="w-full py-3 rounded-xl bg-amber text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <span>📷</span> Capture Invoice
              </button>

              {/* Upload from gallery */}
              <button
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = handlePhotoCapture
                  input.click()
                }}
                className="w-full py-2.5 rounded-xl bg-surface border border-border text-sm text-muted font-mono flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <span>🖼️</span> Choose from Gallery
              </button>

              {/* Skip option */}
              <button
                onClick={() => setInvoiceSkipped(true)}
                className="w-full py-2 text-[11px] font-mono text-muted/60 underline underline-offset-2"
              >
                Skip — I'll add later
              </button>
            </div>
          )}

          {invoiceSkipped && !invoicePhoto && (
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono text-amber/70">Invoice skipped — flagged for follow-up</p>
              <button
                onClick={() => setInvoiceSkipped(false)}
                className="text-[10px] font-mono text-blue underline"
              >
                Add now
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

// ── Valuation Modal ────────────────────────────────────────────────────────────
function ValuationModal({ onClose }) {
  const assets              = useMinervaStore(s => s.assets)
  const updateAssetValuation = useMinervaStore(s => s.updateAssetValuation)
  const [assetId, setAssetId] = useState(assets[0]?.id || '')
  const [value, setValue]     = useState('')
  const [basis, setBasis]     = useState('market_estimate')

  const handleSubmit = () => {
    if (!value || !assetId) return
    updateAssetValuation(assetId, parseFloat(value), basis)
    onClose()
  }

  return (
    <Sheet title="Update Asset Valuation" onClose={onClose} onSubmit={handleSubmit} submitLabel="Update" submitColor="bg-sage">
      <Field label="Asset">
        <select value={assetId} onChange={e => setAssetId(e.target.value)} className={selectCls}>
          {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="New Valuation (AED)">
        <input type="number" placeholder="0" value={value} onChange={e => setValue(e.target.value)} className={inputCls} autoFocus />
      </Field>
      <Field label="Basis">
        <select value={basis} onChange={e => setBasis(e.target.value)} className={selectCls}>
          <option value="market_estimate">Market Estimate</option>
          <option value="confirmed">Confirmed (Valuation Report)</option>
          <option value="cost">Cost Basis</option>
          <option value="nav">NAV (Fund Statement)</option>
        </select>
      </Field>
    </Sheet>
  )
}

// ── Budget Modal ───────────────────────────────────────────────────────────────
function BudgetModal({ onClose }) {
  const updateBudgetLimit = useMinervaStore(s => s.updateBudgetLimit)
  const [category, setCategory] = useState('groceries')
  const [limit, setLimit]       = useState('')

  const handleSubmit = () => {
    if (!limit) return
    const month = new Date().toISOString().slice(0, 7)
    updateBudgetLimit(month, category, parseFloat(limit))
    onClose()
  }

  return (
    <Sheet title="Adjust Budget Limit" onClose={onClose} onSubmit={handleSubmit} submitLabel="Update Budget" submitColor="bg-amber">
      <Field label="Category">
        <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
          {Object.entries(CATEGORY_META)
            .filter(([k]) => !['salary','rental','dividends'].includes(k))
            .map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </Field>
      <Field label="Monthly Limit (AED)">
        <input type="number" placeholder="0" value={limit} onChange={e => setLimit(e.target.value)} className={inputCls} autoFocus />
      </Field>
    </Sheet>
  )
}

// ── Milestone Modal ────────────────────────────────────────────────────────────
function MilestoneModal({ onClose }) {
  const targets            = useMinervaStore(s => s.targets)
  const updateTargetProgress = useMinervaStore(s => s.updateTargetProgress)
  const [targetId, setTargetId] = useState(targets[0]?.id || '')
  const [progress, setProgress] = useState('')

  const handleSubmit = () => {
    if (!progress) return
    updateTargetProgress(targetId, parseFloat(progress))
    onClose()
  }

  return (
    <Sheet title="Log Milestone Progress" onClose={onClose} onSubmit={handleSubmit} submitLabel="Update Progress" submitColor="bg-teal">
      <Field label="Target">
        <select value={targetId} onChange={e => setTargetId(e.target.value)} className={selectCls}>
          {targets.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </Field>
      <Field label="Current Progress Amount">
        <input type="number" placeholder="0" value={progress} onChange={e => setProgress(e.target.value)} className={inputCls} autoFocus />
      </Field>
    </Sheet>
  )
}

// ── Document Modal ─────────────────────────────────────────────────────────────
function DocumentModal({ onClose }) {
  const addDocument = useMinervaStore(s => s.addDocument)
  const [form, setForm] = useState({ title: '', category: 'statement', driveUrl: '', tags: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.title) return
    addDocument({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) })
    onClose()
  }

  return (
    <Sheet title="Add Document" onClose={onClose} onSubmit={handleSubmit} submitLabel="Add Document" submitColor="bg-blue">
      <Field label="Title">
        <input type="text" placeholder="e.g. ADCB Statement Apr-26" value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} autoFocus />
      </Field>
      <Field label="Category">
        <select value={form.category} onChange={e => set('category', e.target.value)} className={selectCls}>
          <option value="statement">Bank Statement</option>
          <option value="legal">Legal Agreement</option>
          <option value="identity">Identity Document</option>
          <option value="property">Property Document</option>
          <option value="investment">Investment Certificate</option>
          <option value="insurance">Insurance Policy</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Google Drive URL">
        <input type="url" placeholder="https://drive.google.com/file/d/…" value={form.driveUrl} onChange={e => set('driveUrl', e.target.value)} className={inputCls} />
      </Field>
      <Field label="Tags (comma separated)">
        <input type="text" placeholder="e.g. ADCB, 2026, statement" value={form.tags} onChange={e => set('tags', e.target.value)} className={inputCls} />
      </Field>
    </Sheet>
  )
}
