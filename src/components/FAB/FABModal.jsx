// src/components/FAB/FABModal.jsx
import { useState } from 'react'
import { useMinervaStore } from '../../state/store.js'
import { CATEGORY_META } from '../../theme.js'

export function FABModal({ context, onClose }) {
  const MODALS = {
    dashboard:    TransactionModal,
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

// ── Transaction Modal ──────────────────────────────────────────────────────────
function TransactionModal({ onClose }) {
  const accounts        = useMinervaStore(s => s.accounts)
  const addTransaction  = useMinervaStore(s => s.addTransaction)

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    accountId: 'adcb-consolidated-kedar',
    amount: '',
    isExpense: true,
    currency: 'AED',
    category: 'groceries',
    description: '',
    loggedBy: 'Kedar',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.amount || !form.accountId) return
    const amt = parseFloat(form.amount)
    addTransaction({
      ...form,
      amount: form.isExpense ? -Math.abs(amt) : Math.abs(amt),
    })
    onClose()
  }

  const activeAccounts = accounts.filter(a => a.active && !['credit_card'].includes(a.type))

  return (
    <Sheet
      title="Log Transaction"
      subtitle={`${new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Log Transaction"
    >
      {/* Expense / Income toggle */}
      <div className="flex gap-2">
        {[true, false].map(isExp => (
          <button
            key={String(isExp)}
            onClick={() => set('isExpense', isExp)}
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

      {/* Amount */}
      <Field label="Amount">
        <div className="flex gap-2">
          <select
            value={form.currency}
            onChange={e => set('currency', e.target.value)}
            className={`${selectCls} w-24 flex-shrink-0`}
          >
            {['AED', 'USD', 'INR', 'SGD'].map(c => <option key={c}>{c}</option>)}
          </select>
          <input
            type="number"
            placeholder="0"
            value={form.amount}
            onChange={e => set('amount', e.target.value)}
            className={`${inputCls} flex-1`}
            autoFocus
          />
        </div>
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
                  ${form.category === key
                    ? 'bg-navy text-white border-navy'
                    : 'bg-alabaster text-muted border-border'
                  }`}
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
