// src/components/FAB/FABModal.jsx
import { useState, useRef } from 'react'
import { useMinervaStore }  from '../../state/store.js'
import { parseStatement, parseStatementRows, ACCOUNT_NUMBER_MAP, detectBank } from '../../utils/statementParsers.js'
import { categoriseTransaction, recategoriseAll } from '../../utils/categoryRules.js'
import { CATEGORY_META } from '../../theme.js'

// ─── Shared UI primitives ─────────────────────────────────────────────────────

const selectCls = 'w-full px-3.5 py-3 rounded-xl border border-border bg-alabaster text-sm text-slate font-mono focus:outline-none focus:border-blue/40'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-mono text-muted uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Sheet({ title, subtitle, onClose, onSubmit, submitLabel, children }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-surface rounded-t-3xl shadow-2xl p-5 pb-10 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-navy">{title}</h3>
            {subtitle && <p className="text-[10px] font-mono text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted text-sm">✕</button>
        </div>
        <div className="space-y-4">{children}</div>
        {onSubmit && (
          <button onClick={onSubmit}
            className="mt-5 w-full py-3.5 bg-navy text-white rounded-2xl text-sm font-semibold active:scale-[0.98] transition-all">
            {submitLabel ?? 'Save'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Statement Import Modal ───────────────────────────────────────────────────

function StatementImportModal({ onClose }) {
  const accounts             = useMinervaStore(s => s.accounts)
  const bulkAddTransactions  = useMinervaStore(s => s.bulkAddTransactions)

  const [step, setStep]               = useState('upload')
  const [parsed, setParsed]           = useState(null)
  const [accountId, setAccountId]     = useState('')
  const [error, setError]             = useState(null)
  const [importing, setImporting]     = useState(false)
  const [importSummary, setImportSummary] = useState(null)
  const fileRef = useRef(null)

  // ── Parse result ──────────────────────────────────────────────────────────
  const reconCheck = parsed ? (() => {
    const sum     = parsed.transactions.reduce((s, t) => s + t.amount, 0)
    const opening = parsed.openingBalance
    const closing = parsed.closingBalance
    if (opening == null || closing == null) return { sum, ok: null, diff: null, expected: null }
    const expected = opening + sum
    const diff     = Math.abs(expected - closing)
    return { sum, expected, diff, ok: diff < 0.5 }
  })() : null

  const fmt = (n) => n == null ? 'N/A' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // ── File handler ──────────────────────────────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    const isXlsx = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')

    try {
      let result

      if (isXlsx) {
        const XLSX  = await import('xlsx')
        const buf   = await file.arrayBuffer()
        const wb    = XLSX.read(buf, { type: 'array' })
        const ws    = wb.Sheets[wb.SheetNames[0]]
        const rows  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        result = parseStatementRows(rows, null, file.name)
      } else {
        const text = await file.text()
        const bank = detectBank(text, file.name)
        if (!bank) {
          setError('Bank not recognised. Rename file to include: HSBC, WIO, ADCB, NBD, ENBD')
          return
        }
        result = parseStatement(text, bank, file.name)
      }

      if (result.error) { setError(result.error); return }
      if (!result.transactions?.length) { setError('No transactions found in file'); return }

      // Auto-match account
      let matchedId = ACCOUNT_NUMBER_MAP[result.accountNumber] ?? ''
      if (!matchedId) {
        if (result.bankName === 'ENBD') matchedId = result.accountType === 'credit_card' ? 'enbd-cc-kedar' : 'enbd-current-kedar'
        if (result.bankName === 'HSBC') matchedId = result.accountType === 'credit_card' ? 'hsbc-cc-kedar' : 'hsbc-current-kedar'
        if (result.bankName === 'Wio')  matchedId = result.accountType === 'credit_card' ? 'wio-cc-kedar'  : 'wio-current-kedar'
        if (result.bankName === 'ADCB') matchedId = result.accountType === 'credit_card' ? 'adcb-consolidated-kedar' : 'adcb-consolidated-kedar'
      }

      setAccountId(matchedId)
      setParsed(result)
      setStep('preview')

    } catch (err) {
      setError('Failed to read file: ' + err.message)
    }
  }

  // ── Import handler ────────────────────────────────────────────────────────
  const handleImport = () => {
    if (!parsed || !accountId) return
    setImporting(true)

    const existing    = useMinervaStore.getState().transactions
    const dedupKey    = t => `${t.date}|${Number(t.amount).toFixed(2)}|${(t.description||'').slice(0,30)}|${t.accountId}`
    const existingSet = new Set(existing.map(dedupKey))

    const newTxns = parsed.transactions
      .map((txn, i) => ({
        id:          `imp_${Date.now()}_${i}`,
        date:        txn.date,
        accountId,
        amount:      txn.amount,
        currency:    txn.currency ?? parsed.currency ?? 'AED',
        description: txn.description ?? '',
        category:    categoriseTransaction(txn),
        loggedBy:    'Import',
        reference:   txn.reference ?? '',
        type:        'imported',
        status:      'imported',
        createdAt:   new Date().toISOString(),
      }))
      .filter(t => !existingSet.has(dedupKey(t)))

    const skipped = parsed.transactions.length - newTxns.length

    // Push to store via persisted action
    bulkAddTransactions(newTxns)

    // Update account reconciled balance
    if (parsed.closingBalance != null) {
      const closingDate = parsed.period?.split(' to ')[1] ?? new Date().toISOString().slice(0, 10)
      const accts = useMinervaStore.getState().accounts
      useMinervaStore.setState({
        accounts: accts.map(a => a.id === accountId
          ? { ...a, reconciledBalance: parsed.closingBalance, reconciledAt: closingDate, reconciledDiscrepancy: reconCheck?.diff ?? 0 }
          : a
        )
      })
    }

    useMinervaStore.getState()._recompute()
    setImportSummary({ added: newTxns.length, skipped })
    setImporting(false)
    setStep('done')
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-surface rounded-t-3xl shadow-2xl p-5 pb-10 text-center">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />
        <p className="text-4xl mb-3">✅</p>
        <p className="text-base font-bold text-navy">Import Complete</p>
        <p className="text-xs font-mono text-muted mt-1">
          {importSummary?.added} imported{importSummary?.skipped > 0 ? ` · ${importSummary.skipped} duplicates skipped` : ''}
        </p>
        {reconCheck?.ok === false && (
          <div className="mt-4 px-4 py-2.5 bg-rose-lt border border-rose/20 rounded-xl">
            <p className="text-xs font-mono text-rose">⚠ Off by {parsed.currency} {fmt(reconCheck.diff)}</p>
          </div>
        )}
        {reconCheck?.ok === true && (
          <div className="mt-4 px-4 py-2.5 bg-sage-lt border border-sage/20 rounded-xl">
            <p className="text-xs font-mono text-sage">✓ Balances reconciled</p>
          </div>
        )}
        <button
          onClick={() => { const txns = useMinervaStore.getState().transactions; useMinervaStore.setState({ transactions: recategoriseAll(txns) }) }}
          className="mt-3 w-full py-3 border border-border rounded-2xl text-xs font-mono text-muted active:bg-alabaster active:scale-[0.98] transition-all cursor-pointer">
          ↺ Re-categorise all transactions
        </button>
        <button onClick={onClose} className="mt-3 w-full py-3.5 bg-navy text-white rounded-2xl text-sm font-semibold">Done</button>
      </div>
    </div>
  )

  // ── Preview screen ────────────────────────────────────────────────────────
  if (step === 'preview' && parsed) return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-surface rounded-t-3xl shadow-2xl p-5 pb-10 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
        <h3 className="text-base font-semibold text-navy mb-1">Preview Import</h3>
        <p className="text-xs font-mono text-muted mb-4">{parsed.bankName} · {parsed.accountNumber ?? 'auto-detected'} · {parsed.currency}</p>

        {/* Reconciliation */}
        <div className={`rounded-xl p-3 mb-4 ${reconCheck?.ok === true ? 'bg-sage-lt/50 border border-sage/20' : reconCheck?.ok === false ? 'bg-rose-lt/50 border border-rose/20' : 'bg-alabaster border border-border'}`}>
          <div className="flex justify-between text-[10px] font-mono mb-1">
            <span className="text-muted">Opening Balance</span>
            <span className="text-slate">{parsed.currency} {fmt(parsed.openingBalance)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono mb-1">
            <span className="text-muted">Net ({parsed.transactions.length} txns)</span>
            <span className={reconCheck?.sum >= 0 ? 'text-sage' : 'text-rose'}>
              {reconCheck?.sum >= 0 ? '+' : ''}{parsed.currency} {fmt(reconCheck?.sum)}
            </span>
          </div>
          {reconCheck?.expected != null && (
            <div className="flex justify-between text-[10px] font-mono mb-1 border-t border-black/8 pt-1">
              <span className="text-muted">Expected Closing</span>
              <span className="text-slate">{parsed.currency} {fmt(reconCheck.expected)}</span>
            </div>
          )}
          <div className="flex justify-between text-[10px] font-mono font-bold">
            <span className="text-muted">Statement Closing</span>
            <span className="text-slate">{parsed.currency} {fmt(parsed.closingBalance)}</span>
          </div>
          <div className={`mt-2 text-center text-[10px] font-mono font-bold ${reconCheck?.ok === true ? 'text-sage' : reconCheck?.ok === false ? 'text-rose' : 'text-muted'}`}>
            {reconCheck?.ok === true ? '✓ Balanced' : reconCheck?.ok === false ? `⚠ Off by ${parsed.currency} ${fmt(reconCheck.diff)}` : 'No balance check available'}
          </div>
        </div>

        {/* Account selector */}
        <Field label="Import into Account">
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={selectCls}>
            <option value="">— Select account —</option>
            {accounts.filter(a => a.active).map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </select>
          {accountId && <p className="text-[9px] font-mono text-sage mt-1">✓ Auto-matched</p>}
        </Field>

        {/* Sample */}
        <div>
          <p className="text-[10px] font-mono text-muted uppercase tracking-wide mb-2">First 5 transactions</p>
          <div className="bg-alabaster rounded-xl overflow-hidden border border-border">
            {parsed.transactions.slice(0, 5).map((t, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 ${i < 4 ? 'border-b border-border/50' : ''}`}>
                <span className="text-[9px] font-mono text-muted w-20 flex-shrink-0">{t.date}</span>
                <span className="text-[10px] text-slate flex-1 truncate">{t.description}</span>
                <span className={`text-[10px] font-mono font-semibold flex-shrink-0 ${t.amount >= 0 ? 'text-sage' : 'text-rose'}`}>
                  {t.amount >= 0 ? '+' : ''}{Number(t.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={() => setStep('upload')} className="flex-1 py-3 border border-border rounded-2xl text-sm text-muted">Back</button>
          <button
            onClick={handleImport}
            disabled={!accountId || importing}
            className={`flex-1 py-3 rounded-2xl text-sm font-semibold text-white ${accountId ? 'bg-navy' : 'bg-border cursor-not-allowed'}`}>
            {importing ? 'Importing…' : `Import ${parsed.transactions.length} transactions`}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Upload screen ─────────────────────────────────────────────────────────
  return (
    <Sheet title="Import Statement" subtitle="ADCB · ENBD · HSBC · Wio Current · Wio Credit" onClose={onClose}>
      <div onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer active:bg-alabaster">
        <p className="text-3xl mb-2">📂</p>
        <p className="text-sm font-semibold text-slate">Select bank statement file</p>
        <p className="text-[10px] font-mono text-muted mt-1">CSV or XLSX · File name must include bank name</p>
      </div>
      {error && <div className="bg-rose-lt border border-rose/20 rounded-xl px-3 py-2.5"><p className="text-xs font-mono text-rose">{error}</p></div>}
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
    </Sheet>
  )
}

// ─── Reconcile Modal ──────────────────────────────────────────────────────────

function ReconcileModal({ onClose }) {
  const accounts          = useMinervaStore(s => s.accounts)
  const selectLiveBalance = useMinervaStore(s => s.selectLiveBalance)

  const [accountId, setAccountId] = useState('')
  const [liveInput, setLiveInput] = useState('')
  const [step, setStep]           = useState('select')

  const account = accounts.find(a => a.id === accountId)
  const tracked = account ? selectLiveBalance(accountId) : 0
  const live    = parseFloat(liveInput) || 0
  const diff    = live - tracked
  const matched = Math.abs(diff) < 0.01
  const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handlePost = () => {
    if (!matched) {
      const adjTxn = {
        id: `adj_${Date.now()}`, date: new Date().toISOString().slice(0,10),
        accountId, amount: diff, currency: account.currency,
        description: 'Reconciliation adjustment', category: 'other',
        type: 'reconciliation_adjustment', status: 'reconciled',
        loggedBy: 'Reconcile', createdAt: new Date().toISOString(),
      }
      useMinervaStore.setState(s => ({ transactions: [...s.transactions, adjTxn] }))
    }
    const accts = useMinervaStore.getState().accounts
    useMinervaStore.setState({
      accounts: accts.map(a => a.id === accountId
        ? { ...a, reconciledBalance: live, reconciledAt: new Date().toISOString().slice(0,10) }
        : a
      )
    })
    useMinervaStore.getState()._recompute()
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
    <Sheet title={`Reconcile — ${account?.shortName}`} subtitle={`Minerva: ${account?.currency} ${fmt(tracked)}`} onClose={onClose}
      onSubmit={() => liveInput && setStep(matched ? 'done' : 'confirm')} submitLabel="Check Balance">
      <Field label="Your actual balance right now">
        <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl border border-border bg-alabaster">
          <span className="text-xs font-mono text-muted">{account?.currency}</span>
          <input type="number" value={liveInput} onChange={e => setLiveInput(e.target.value)}
            placeholder="0.00" autoFocus className="flex-1 bg-transparent text-sm font-mono text-slate focus:outline-none" />
        </div>
      </Field>
      {liveInput && (
        <div className={`rounded-xl px-3 py-2.5 text-xs font-mono ${matched ? 'bg-sage-lt text-sage' : 'bg-amber-lt text-amber'}`}>
          {matched ? '✓ Balances match' : `Discrepancy: ${account?.currency} ${fmt(Math.abs(diff))}`}
        </div>
      )}
    </Sheet>
  )

  return (
    <Sheet title="Reconcile Account" subtitle="Update a live balance" onClose={onClose}
      onSubmit={() => accountId && setStep('input')} submitLabel="Next →">
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

// ─── Transaction Modal ────────────────────────────────────────────────────────

function TransactionModal({ onClose }) {
  const accounts = useMinervaStore(s => s.accounts)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0,10),
    accountId: '', amount: '', description: '', category: 'other', notes: ''
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.accountId || !form.amount) return
    const txn = {
      id: `txn_${Date.now()}`, date: form.date, accountId: form.accountId,
      amount: parseFloat(form.amount), currency: accounts.find(a => a.id === form.accountId)?.currency ?? 'AED',
      description: form.description, category: form.category,
      type: 'manual', status: 'unreconciled', loggedBy: 'Manual',
      createdAt: new Date().toISOString(),
    }
    useMinervaStore.setState(s => ({ transactions: [...s.transactions, txn] }))
    useMinervaStore.getState()._recompute()
    onClose()
  }

  return (
    <Sheet title="Log Transaction" onClose={onClose} onSubmit={handleSave} submitLabel="Save Transaction">
      <Field label="Date">
        <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
          className={selectCls} />
      </Field>
      <Field label="Account">
        <select value={form.accountId} onChange={e => set('accountId', e.target.value)} className={selectCls}>
          <option value="">— Select account —</option>
          {accounts.filter(a => a.active).map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Amount (negative = expense)">
        <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
          placeholder="-150.00" className={selectCls} />
      </Field>
      <Field label="Description">
        <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="e.g. Carrefour groceries" className={selectCls} />
      </Field>
      <Field label="Category">
        <select value={form.category} onChange={e => set('category', e.target.value)} className={selectCls}>
          {Object.entries(CATEGORY_META).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
      </Field>
    </Sheet>
  )
}

// ─── Document Modal ───────────────────────────────────────────────────────────

function DocumentModal({ onClose }) {
  const [form, setForm] = useState({ title: '', driveUrl: '', tags: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.title) return
    const doc = {
      id: `doc_${Date.now()}`, title: form.title, driveUrl: form.driveUrl,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      dateAdded: new Date().toISOString().slice(0,10), pinned: false, linked_doc_uids: [],
    }
    useMinervaStore.setState(s => ({ documents: [...s.documents, doc] }))
    onClose()
  }

  return (
    <Sheet title="Add Document" onClose={onClose} onSubmit={handleSave} submitLabel="Add to Vault">
      <Field label="Document Title">
        <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
          placeholder="e.g. ADCB Statement Jan 2026" className={selectCls} />
      </Field>
      <Field label="Google Drive URL">
        <input type="url" value={form.driveUrl} onChange={e => set('driveUrl', e.target.value)}
          placeholder="https://drive.google.com/..." className={selectCls} />
      </Field>
      <Field label="Tags (comma separated)">
        <input type="text" value={form.tags} onChange={e => set('tags', e.target.value)}
          placeholder="Kedar, ADCB, 2026" className={selectCls} />
      </Field>
    </Sheet>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export function FABModal({ context, onClose }) {
  const MODALS = {
    dashboard: TransactionModal,
    import:    StatementImportModal,
    reconcile: ReconcileModal,
    documents: DocumentModal,
  }

  const Modal = MODALS[context] ?? TransactionModal
  return <Modal onClose={onClose} />
}
