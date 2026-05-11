// src/state/store.js — Minerva Financial: The Brain
// Single source of truth. Zero UI. Pure logic.
//
// DATA MODEL
// ──────────
// LIVE BALANCE (per account) = reconciledBalance + SUM(unreconciled txns since reconciledAt)
// LIVE LIQUIDITY             = SUM(liveBalance for liquid accounts) converted to AED
// NET WORTH                  = SUM(asset valuations AED) − SUM(liability balances AED)
//
// On reconcile():
//   drift = actualBalance − trackedLiveBalance
//   A ReconciliationAdjustment transaction is created to explain the gap.
//   reconciledBalance and reconciledAt are updated to the new anchor.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  ACCOUNTS_SEED, ASSETS_SEED, LIABILITIES_SEED,
  TARGETS_SEED, BUDGETS_SEED, DOCUMENTS_SEED, FX_SEED,
  SURPLUS_CONFIG_SEED,
} from '../data/seed.js'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const LIQUID_TYPES          = new Set(['current', 'savings'])
const LIABILITY_ACCT_TYPES  = new Set(['credit_card'])

// ─── PURE MATH FUNCTIONS ──────────────────────────────────────────────────────

function toAED(amount, currency, fx) {
  if (!amount || isNaN(amount)) return 0
  if (currency === 'AED') return amount
  if (currency === 'USD') return amount * fx.USD_AED
  if (currency === 'INR') return amount * fx.INR_AED
  if (currency === 'SGD') return amount * fx.SGD_AED
  return amount
}

function fromAED(amountAED, targetCurrency, fx) {
  if (targetCurrency === 'AED') return amountAED
  if (targetCurrency === 'USD') return amountAED * fx.AED_USD
  if (targetCurrency === 'INR') return amountAED * fx.AED_INR
  return amountAED
}

/**
 * Live balance for one account.
 * = reconciledBalance + SUM(unreconciled transactions since reconciledAt)
 */
function computeLiveBalance(account, transactions) {
  const base = account.reconciledBalance ?? 0
  const drift = transactions
    .filter(t =>
      t.accountId === account.id &&
      t.status !== 'reconciled' &&
      (!account.reconciledAt || t.date >= account.reconciledAt)
    )
    .reduce((sum, t) => sum + (t.amount ?? 0), 0)
  return base + drift
}

/**
 * Total liquid cash in AED.
 * Only current + savings accounts. Credit cards excluded (they are liabilities).
 */
function computeLiveLiquidity(accounts, transactions, fx) {
  return accounts
    .filter(a => a.active && LIQUID_TYPES.has(a.type))
    .reduce((total, a) => total + toAED(computeLiveBalance(a, transactions), a.currency, fx), 0)
}

/**
 * Net worth in AED.
 * = Total assets − structured liabilities − live credit card balances
 */
function computeNetWorth(assets, liabilities, accounts, transactions, fx) {
  const totalAssets = assets.reduce((s, a) => s + (a.valuationAED ?? 0), 0)

  const structuredLiabs = liabilities.reduce((s, l) =>
    s + toAED(l.outstandingBalance ?? 0, l.currency, fx), 0)

  const cardLiabs = accounts
    .filter(a => a.active && LIABILITY_ACCT_TYPES.has(a.type))
    .reduce((s, a) => s + toAED(Math.max(0, computeLiveBalance(a, transactions)), a.currency, fx), 0)

  return totalAssets - structuredLiabs - cardLiabs
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

const genId  = (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
const nowISO = () => new Date().toISOString()
const todayStr = () => new Date().toISOString().slice(0, 10)
const monthEnd = (month) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// ─── STORE ────────────────────────────────────────────────────────────────────

export const useMinervaStore = create(
  persist(
    (set, get) => ({

      // ── Planned spends (what-if layer) ───────────────────────────────────
      // Each item: { id, label, amount, currency, date, category }
      // Added by user for one-off future purchases that affect the projection
      plannedSpends: [],

      // ── Period tracking ──────────────────────────────────────────────────
      // initialBalance: the verified opening balance at the start of the period
      // periodStart: 'YYYY-MM-DD' — transactions before this date are excluded
      // Both are user-configurable from the Surplus Engine card
      initialBalance: 0,          // set this to your real opening balance
      initialBalanceCurrency: 'AED',
      periodStart: new Date().toISOString().slice(0, 7) + '-01', // first of current month

      // ── Collections (seeded) ─────────────────────────────────────────────
      accounts:          ACCOUNTS_SEED,
      assets:            ASSETS_SEED,
      liabilities:       LIABILITIES_SEED,
      targets:           TARGETS_SEED,
      budgets:           [BUDGETS_SEED],
      documents:         DOCUMENTS_SEED,
      surplusConfig:     SURPLUS_CONFIG_SEED,
      fx:                FX_SEED,
      transactions:      [],
      reconciliationLog: [],

      // ── Derived (recomputed after every mutation) ─────────────────────────
      liveLiquidity: computeLiveLiquidity(ACCOUNTS_SEED, [], FX_SEED),
      netWorth:      computeNetWorth(ASSETS_SEED, LIABILITIES_SEED, ACCOUNTS_SEED, [], FX_SEED),

      // ── UI state ──────────────────────────────────────────────────────────
      activeCurrency: 'AED',
      activeTab:      'dashboard',
      ownerFilter:    'all',   // 'all' | 'Kedar' | 'Anisha' | 'Family'
      fabOpen:        false,
      fabContext:     null,
      syncStatus:     'idle',
      lastSyncedAt:   null,

      // ── Internal: recompute derived values ────────────────────────────────
      _recompute() {
        const s = get()
        set({
          liveLiquidity: computeLiveLiquidity(s.accounts, s.transactions, s.fx),
          netWorth:      computeNetWorth(s.assets, s.liabilities, s.accounts, s.transactions, s.fx),
        })
      },

      // ═══════════════════════════════════════════════════════════════════════
      // ACTION: logTransaction
      //
      // type:      'expense' | 'income' | 'transfer' | 'investment'
      // amount:    Always positive. Direction is determined by type + account type.
      // category:  Key from CATEGORY_META
      // accountId: Which account this hits
      // opts:      { currency, description, date, loggedBy, toAccountId, toCurrency }
      //
      // SIGN CONVENTION (stored amount):
      //   Current/savings income        → positive
      //   Current/savings expense       → negative
      //   Credit card spend             → positive (increases debt)
      //   Credit card payment           → negative (reduces debt)
      //
      // RIPPLE: calls _recompute() → updates liveLiquidity + netWorth
      // ═══════════════════════════════════════════════════════════════════════

      logTransaction(type, amount, category, accountId, opts = {}) {
        const { accounts, _recompute } = get()
        const account = accounts.find(a => a.id === accountId)
        if (!account) {
          console.error(`[Minerva] logTransaction: account "${accountId}" not found`)
          return null
        }

        const abs = Math.abs(amount)

        // Determine signed amount
        let signed
        if (account.type === 'credit_card') {
          signed = (type === 'income') ? -abs : abs   // payment reduces debt
        } else {
          signed = (type === 'income') ? abs : -abs   // income positive, spend negative
        }

        const txn = {
          id:          genId('txn'),
          date:        opts.date        ?? todayStr(),
          accountId,
          amount:      signed,
          currency:    opts.currency    ?? account.currency,
          type,
          category:    category         ?? 'other',
          description: opts.description ?? '',
          loggedBy:    opts.loggedBy    ?? 'Kedar',
          status:      'pending',
          createdAt:   nowISO(),
        }

        const newTxns = [txn]

        // Transfer: create matching credit on destination account
        if (type === 'transfer' && opts.toAccountId) {
          const dest = accounts.find(a => a.id === opts.toAccountId)
          if (dest) {
            const counterTxn = {
              id:          genId('txn'),
              date:        txn.date,
              accountId:   opts.toAccountId,
              amount:      abs,
              currency:    opts.toCurrency ?? dest.currency,
              type:        'transfer_in',
              category:    'transfers',
              description: `Transfer from ${account.shortName}`,
              loggedBy:    txn.loggedBy,
              status:      'pending',
              createdAt:   nowISO(),
              linkedTxnId: txn.id,
            }
            txn.description = `Transfer to ${dest.shortName}`
            txn.linkedTxnId = counterTxn.id
            newTxns.push(counterTxn)
          }
        }

        set(s => ({ transactions: [...s.transactions, ...newTxns] }))
        _recompute()
        return txn.id
      },

      // ═══════════════════════════════════════════════════════════════════════
      // ACTION: reconcile
      //
      // accountId:     The account being anchored
      // actualBalance: The verified balance from the bank statement
      // month:         'YYYY-MM' (default: current month)
      //
      // DRIFT MATH:
      //   trackedBalance = computeLiveBalance(account, transactions)
      //   drift          = actualBalance − trackedBalance
      //   if |drift| > 0.001:
      //     create ReconciliationAdjustment transaction for the gap
      //   Update reconciledBalance = actualBalance
      //   Mark all account transactions up to month-end as 'reconciled'
      //   Append to reconciliationLog
      //
      // RIPPLE: calls _recompute() → updates liveLiquidity + netWorth
      // ═══════════════════════════════════════════════════════════════════════

      reconcile(accountId, actualBalance, month, opts = {}) {
        const { accounts, transactions, _recompute } = get()
        const account = accounts.find(a => a.id === accountId)
        if (!account) {
          console.error(`[Minerva] reconcile: account "${accountId}" not found`)
          return null
        }

        const reconMonth     = month ?? new Date().toISOString().slice(0, 7)
        const endDay         = monthEnd(reconMonth)
        const cutoff         = `${reconMonth}-${String(endDay).padStart(2, '0')}`
        const trackedBalance = computeLiveBalance(account, transactions)
        const drift          = actualBalance - trackedBalance
        const hasDrift       = Math.abs(drift) > 0.001

        // Build adjustment transaction if drift exists
        const adjustmentTxn = hasDrift ? {
          id:           genId('adj'),
          date:         cutoff,
          accountId,
          amount:       drift,
          currency:     account.currency,
          type:         'reconciliation_adjustment',
          category:     'other',
          description:  [
            `Reconciliation adjustment — ${reconMonth}.`,
            `Drift: ${drift > 0 ? '+' : ''}${drift.toFixed(2)} ${account.currency}.`,
            opts.note ?? '',
          ].filter(Boolean).join(' '),
          loggedBy:     opts.lockedBy ?? 'System',
          status:       'reconciled',
          createdAt:    nowISO(),
          isAdjustment: true,
        } : null

        // Mark existing transactions as reconciled + optionally add adjustment
        set(s => ({
          transactions: [
            ...s.transactions.map(t =>
              t.accountId === accountId && t.date <= cutoff
                ? { ...t, status: 'reconciled' }
                : t
            ),
            ...(adjustmentTxn ? [adjustmentTxn] : []),
          ],
          // Update account anchor
          accounts: s.accounts.map(a =>
            a.id === accountId
              ? { ...a, reconciledBalance: actualBalance, reconciledAt: cutoff }
              : a
          ),
        }))

        // Write to reconciliation log
        const logEntry = {
          id:              genId('recon'),
          accountId,
          accountName:     account.name,
          month:           reconMonth,
          trackedBalance,
          verifiedBalance: actualBalance,
          drift,
          adjustmentTxnId: adjustmentTxn?.id ?? null,
          lockedAt:        nowISO(),
          lockedBy:        opts.lockedBy ?? 'Kedar',
        }
        set(s => ({ reconciliationLog: [...s.reconciliationLog, logEntry] }))

        _recompute()
        return { logEntry, drift, adjustmentCreated: hasDrift }
      },

      // ═══════════════════════════════════════════════════════════════════════
      // ACTIONS — asset / liability / fx / budget / target / document
      // ═══════════════════════════════════════════════════════════════════════

      updateAssetValuation(assetId, valuationAED, basis, date) {
        set(s => ({
          assets: s.assets.map(a => {
            if (a.id !== assetId) return a
            // Append to valuation history before overwriting
            const history = a.valuationHistory ?? []
            const prev = a.valuationAED != null
              ? [{ valuationAED: a.valuationAED, valuationBasis: a.valuationBasis, valuationDate: a.valuationDate }]
              : []
            return {
              ...a,
              valuationAED,
              valuationBasis:   basis ?? a.valuationBasis,
              valuationDate:    date  ?? todayStr(),
              valuationHistory: [...history, ...prev].slice(-12), // keep last 12
            }
          }),
        }))
        get()._recompute()
      },

      updateLiabilityBalance(liabilityId, newBalance) {
        set(s => ({
          liabilities: s.liabilities.map(l =>
            l.id === liabilityId ? { ...l, outstandingBalance: newBalance } : l
          ),
        }))
        get()._recompute()
      },

      updateFX(rates) {
        set(s => ({ fx: { ...s.fx, ...rates, updatedAt: todayStr() } }))
        get()._recompute()
      },

      updateBudgetLimit(month, category, limit) {
        set(s => {
          const idx = s.budgets.findIndex(b => b.month === month)
          if (idx >= 0) {
            const updated = [...s.budgets]
            updated[idx] = {
              ...updated[idx],
              categories: { ...updated[idx].categories, [category]: { ...updated[idx].categories[category], limit } },
            }
            return { budgets: updated }
          }
          return { budgets: [...s.budgets, { month, categories: { [category]: { limit, currency: 'AED' } } }] }
        })
      },

      updateTargetProgress(targetId, progress) {
        set(s => ({ targets: s.targets.map(t => t.id === targetId ? { ...t, currentProgress: progress } : t) }))
      },

      addDocument(doc) {
        set(s => ({
          documents: [...s.documents, {
            id:              genId('doc'),
            title:           doc.title,
            category:        doc.category         ?? 'other',
            linked_doc_uids: doc.linked_doc_uids  ?? doc.linkedTo ?? [],
            driveUrl:        doc.driveUrl          ?? '',
            driveId:         doc.driveId           ?? null,
            dateAdded:       doc.dateAdded         ?? todayStr(),
            tags:            doc.tags              ?? [],
          }],
        }))
      },

      // Link a document uid to an asset's linked_doc_uids[]
      linkDocToAsset(assetId, docId) {
        set(s => ({
          assets: s.assets.map(a =>
            a.id === assetId
              ? { ...a, linked_doc_uids: [...new Set([...(a.linked_doc_uids ?? []), docId])] }
              : a
          ),
        }))
      },

      // Link a document uid to a liability's linked_doc_uids[]
      linkDocToLiability(liabilityId, docId) {
        set(s => ({
          liabilities: s.liabilities.map(l =>
            l.id === liabilityId
              ? { ...l, linked_doc_uids: [...new Set([...(l.linked_doc_uids ?? []), docId])] }
              : l
          ),
        }))
      },

      // Update surplus config (income or commitment amounts)
      updateSurplusConfig(patch) {
        set(s => ({ surplusConfig: { ...s.surplusConfig, ...patch } }))
      },

      deleteTransaction(txnId) {
        set(s => ({ transactions: s.transactions.filter(t => t.id !== txnId) }))
        get()._recompute()
      },

      // ═══════════════════════════════════════════════════════════════════════
      // SELECTORS
      // Pure read functions. Components subscribe to these.
      // ═══════════════════════════════════════════════════════════════════════

      selectLiveBalance(accountId) {
        const { accounts, transactions } = get()
        const account = accounts.find(a => a.id === accountId)
        return account ? computeLiveBalance(account, transactions) : 0
      },

      selectLiquidityIn(targetCurrency) {
        const { liveLiquidity, fx } = get()
        return fromAED(liveLiquidity, targetCurrency, fx)
      },

      selectNetWorthIn(targetCurrency) {
        const { netWorth, fx } = get()
        return fromAED(netWorth, targetCurrency, fx)
      },

      selectTotalAssetsAED() {
        return get().assets.reduce((s, a) => s + (a.valuationAED ?? 0), 0)
      },

      selectTotalLiabilitiesAED() {
        const { liabilities, accounts, transactions, fx } = get()
        return (
          liabilities.reduce((s, l) => s + toAED(l.outstandingBalance ?? 0, l.currency, fx), 0) +
          accounts
            .filter(a => a.active && LIABILITY_ACCT_TYPES.has(a.type))
            .reduce((s, a) => s + toAED(Math.max(0, computeLiveBalance(a, transactions)), a.currency, fx), 0)
        )
      },

      selectLiquidityByCountry() {
        const { accounts, transactions, fx } = get()
        return accounts.filter(a => a.active && LIQUID_TYPES.has(a.type)).reduce((g, a) => {
          const bal = toAED(computeLiveBalance(a, transactions), a.currency, fx)
          g[a.country] = (g[a.country] ?? 0) + bal
          return g
        }, {})
      },

      selectLiquidityByOwner() {
        const { accounts, transactions, fx } = get()
        return accounts.filter(a => a.active && LIQUID_TYPES.has(a.type)).reduce((g, a) => {
          const bal = toAED(computeLiveBalance(a, transactions), a.currency, fx)
          g[a.owner] = (g[a.owner] ?? 0) + bal
          return g
        }, {})
      },

      selectAccountsGroupedByCountry() {
        return get().accounts.reduce((g, a) => {
          if (!g[a.country]) g[a.country] = []
          g[a.country].push(a)
          return g
        }, {})
      },

      selectAssetsByType() {
        return get().assets.reduce((g, a) => {
          if (!g[a.type]) g[a.type] = []
          g[a.type].push(a)
          return g
        }, {})
      },

      selectTransactionsForAccount(accountId) {
        return [...get().transactions].filter(t => t.accountId === accountId)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
      },

      selectTransactionsForMonth(month) {
        return [...get().transactions].filter(t => t.date.startsWith(month))
          .sort((a, b) => new Date(b.date) - new Date(a.date))
      },

      selectPendingTransactions() {
        return [...get().transactions].filter(t => t.status === 'pending')
          .sort((a, b) => new Date(b.date) - new Date(a.date))
      },

      selectBurnRate(category, month) {
        const { transactions, fx } = get()
        const m = month ?? new Date().toISOString().slice(0, 7)
        return transactions
          .filter(t => t.category === category && t.date.startsWith(m) && t.amount < 0 && t.type !== 'reconciliation_adjustment')
          .reduce((s, t) => s + toAED(Math.abs(t.amount), t.currency, fx), 0)
      },

      selectCurrentBudget() {
        const { budgets } = get()
        const m = new Date().toISOString().slice(0, 7)
        return budgets.find(b => b.month === m) ?? budgets[budgets.length - 1]
      },

      selectTargetProgress(targetId) {
        const t = get().targets.find(t => t.id === targetId)
        if (!t || t.targetAmount <= 0) return 0
        return Math.min((t.currentProgress / t.targetAmount) * 100, 100)
      },

      selectFCNRDaysRemaining() {
        const mat = new Date('2026-08-28')
        const now = new Date(); now.setHours(0,0,0,0)
        return Math.max(0, Math.ceil((mat - now) / 86400000))
      },

      selectInDisplayCurrency(amountAED) {
        const { activeCurrency, fx } = get()
        return fromAED(amountAED, activeCurrency, fx)
      },


      // ── Surplus Engine ─────────────────────────────────────────────────────
      // LiveSurplus = (TotalMonthlyIncome - TotalFixedCommitments) - CurrentActivitySpending
      // All values in AED.
      selectSurplus() {
        const { surplusConfig, transactions, fx } = get()
        const m = new Date().toISOString().slice(0, 7)

        const totalIncome = Object.values(surplusConfig.income)
          .reduce((s, item) => s + toAED(item.amount, item.currency, fx), 0)

        const totalCommitments = Object.values(surplusConfig.commitments)
          .reduce((s, item) => s + toAED(item.amount, item.currency, fx), 0)

        // Activity spending = sum of all expense transactions this month (AED)
        const activitySpending = transactions
          .filter(t =>
            t.date.startsWith(m) &&
            t.amount < 0 &&
            t.type !== 'reconciliation_adjustment' &&
            t.type !== 'transfer' &&
            t.type !== 'investment'
          )
          .reduce((s, t) => s + toAED(Math.abs(t.amount), t.currency, fx), 0)

        const gross    = totalIncome - totalCommitments  // what's left after fixed
        const surplus  = gross - activitySpending        // what's left after activity spend
        const utilized = gross > 0 ? Math.min((activitySpending / gross) * 100, 100) : 0

        return {
          totalIncome,
          totalCommitments,
          gross,            // income minus commitments (the "discretionary envelope")
          activitySpending, // what you've actually spent this month
          surplus,          // gross minus activitySpending
          utilized,         // % of discretionary envelope consumed
          isHealthy: surplus >= 0,
        }
      },

      // ── Vault: docs linked to a specific asset ────────────────────────────
      selectDocsForAsset(assetId) {
        const { assets, documents } = get()
        const asset = assets.find(a => a.id === assetId)
        if (!asset) return []
        const uids = new Set(asset.linked_doc_uids ?? [])
        // Also surface docs that have this asset in their linked_doc_uids
        return documents.filter(d =>
          uids.has(d.id) || (d.linked_doc_uids ?? []).includes(assetId)
        )
      },

      // ── Vault: docs linked to a specific liability ────────────────────────
      selectDocsForLiability(liabilityId) {
        const { liabilities, documents } = get()
        const liab = liabilities.find(l => l.id === liabilityId)
        if (!liab) return []
        const uids = new Set(liab.linked_doc_uids ?? [])
        return documents.filter(d =>
          uids.has(d.id) || (d.linked_doc_uids ?? []).includes(liabilityId)
        )
      },

      // ── Global Search index ───────────────────────────────────────────────
      // Returns ranked results across documents, assets, liabilities
      // Fuzzy: checks if all query chars appear in order (subsequence match)
      selectGlobalSearch(query) {
        if (!query || query.trim().length < 2) return []
        const { documents, assets, liabilities } = get()
        const q = query.toLowerCase().trim()

        // Subsequence fuzzy match — 'fcnr' matches 'FCNR Agreement'
        function fuzzy(text) {
          if (!text) return false
          const t = text.toLowerCase()
          if (t.includes(q)) return true  // exact substring — highest priority
          // subsequence check
          let qi = 0
          for (let i = 0; i < t.length && qi < q.length; i++) {
            if (t[i] === q[qi]) qi++
          }
          return qi === q.length
        }

        function score(text) {
          if (!text) return 0
          const t = text.toLowerCase()
          if (t === q) return 100
          if (t.startsWith(q)) return 80
          if (t.includes(q)) return 60
          return 20  // fuzzy match
        }

        const results = []

        // Search documents
        documents.forEach(d => {
          const fields = [d.title, ...(d.tags ?? []), d.category]
          if (fields.some(f => fuzzy(f))) {
            results.push({
              type: 'document',
              id: d.id,
              title: d.title,
              sub: (d.tags ?? []).slice(0, 2).join(' · '),
              icon: '📄',
              driveUrl: d.driveUrl,
              linked_doc_uids: d.linked_doc_uids ?? [],
              score: Math.max(...fields.map(score)),
            })
          }
        })

        // Search assets
        assets.forEach(a => {
          const fields = [a.name, a.type, a.subtype, a.country, a.owner]
          if (fields.some(f => fuzzy(f))) {
            results.push({
              type: 'asset',
              id: a.id,
              title: a.name,
              sub: `${a.country} · ${a.type}`,
              icon: '📊',
              score: Math.max(...fields.map(score)),
            })
          }
        })

        // Search liabilities
        liabilities.forEach(l => {
          const fields = [l.name, l.type, l.currency]
          if (fields.some(f => fuzzy(f))) {
            results.push({
              type: 'liability',
              id: l.id,
              title: l.name,
              sub: `${l.currency} · ${l.interestRate ? l.interestRate + '%' : 'liability'}`,
              icon: '⚠️',
              score: Math.max(...fields.map(score)),
            })
          }
        })

        return results.sort((a, b) => b.score - a.score).slice(0, 12)
      },



      // ── Owner filter selectors ─────────────────────────────────────────────
      // Returns filtered arrays based on current ownerFilter state.
      // Components must subscribe to BOTH the selector AND ownerFilter
      // to ensure re-renders when filter changes.

      selectFilteredAccounts() {
        const { accounts, ownerFilter } = get()
        if (!ownerFilter || ownerFilter === 'all') return accounts
        if (ownerFilter === 'Family') return accounts.filter(a => a.owner === 'Family')
        // Kedar or Anisha: show their own + Family
        return accounts.filter(a => a.owner === ownerFilter || a.owner === 'Family')
      },

      selectFilteredAssets() {
        const { assets, ownerFilter } = get()
        if (!ownerFilter || ownerFilter === 'all') return assets
        if (ownerFilter === 'Family') return assets.filter(a => a.owner === 'Family')
        return assets.filter(a => a.owner === ownerFilter || a.owner === 'Family')
      },

      selectFilteredLiabilities() {
        const { liabilities, ownerFilter } = get()
        if (!ownerFilter || ownerFilter === 'all') return liabilities
        if (ownerFilter === 'Family') return liabilities.filter(l => l.owner === 'Family')
        return liabilities.filter(l => !l.owner || l.owner === ownerFilter || l.owner === 'Family')
      },




      // ── Deterministic 30-Day Projection ───────────────────────────────────
      //
      // FORMULA (deterministic, not historical average):
      //   Start:     currentRunningBalance  (initialBalance + all transactions to date)
      //   Income:    surplusConfig.income   (known monthly income, prorated daily)
      //   Budget:    budgetCategories       (planned spending limits, remaining after actual spend)
      //   PlannedSpends: user-entered one-off future purchases
      //
      // Returns:
      //   currentBalance    — right now
      //   projectedBalance  — in 30 days
      //   expectedIncome    — total expected income in next 30 days
      //   remainingBudget   — total budget not yet spent
      //   plannedSpendTotal — sum of all planned one-off spends
      //   netSurplus        — projectedBalance - currentBalance
      //   dailySeries       — [{ day, date, balance }] for chart (30 points)
      selectDeterministicProjection() {
        const {
          transactions, initialBalance, initialBalanceCurrency, periodStart,
          surplusConfig, budgets, plannedSpends, fx
        } = get()

        const toAEDLocal = (amt, cur) => {
          if (!amt) return 0
          if (!cur || cur === 'AED') return amt
          if (cur === 'USD') return amt * fx.USD_AED
          if (cur === 'INR') return amt * fx.INR_AED
          if (cur === 'SGD') return amt * fx.SGD_AED
          return amt
        }

        const today     = new Date()
        const todayStr  = today.toISOString().slice(0, 10)
        const startStr  = periodStart ?? today.toISOString().slice(0, 7) + '-01'

        // ── 1. Current running balance ───────────────────────────────────────
        const startBalance = toAEDLocal(initialBalance, initialBalanceCurrency)
        const netTxns = transactions
          .filter(t => t.type !== 'reconciliation_adjustment' && t.date >= startStr && t.date <= todayStr)
          .reduce((s, t) => s + toAEDLocal(t.amount, t.currency), 0)
        const currentBalance = startBalance + netTxns

        // ── 2. Expected income (next 30 days) ────────────────────────────────
        const monthlyIncome = Object.values(surplusConfig.income)
          .reduce((s, item) => s + toAEDLocal(item.amount, item.currency), 0)
        const dailyIncome = monthlyIncome / 30
        const expectedIncome = dailyIncome * 30  // full 30-day income

        // ── 3. Remaining budget (limit minus already spent this month) ────────
        const currentMonth = today.toISOString().slice(0, 7)
        const budget = budgets.find(b => b.month === currentMonth) ?? budgets[budgets.length - 1]

        // What's already been spent this month (AED, expenses only)
        const spentByCategory = transactions
          .filter(t => t.date.startsWith(currentMonth) && t.amount < 0 && t.type !== 'reconciliation_adjustment')
          .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] ?? 0) + toAEDLocal(Math.abs(t.amount), t.currency)
            return acc
          }, {})

        // Remaining budget = sum of (limit - spent) per category, floored at 0
        const remainingBudget = Object.entries(budget?.categories ?? {}).reduce((s, [cat, meta]) => {
          const limit = toAEDLocal(meta.limit, meta.currency ?? 'AED')
          const spent = spentByCategory[cat] ?? 0
          return s + Math.max(0, limit - spent)
        }, 0)

        // Fixed commitments not yet paid (mortgages etc)
        const monthlyCommitments = Object.values(surplusConfig.commitments)
          .reduce((s, item) => s + toAEDLocal(item.amount, item.currency), 0)

        // ── 4. Planned one-off spends in next 30 days ─────────────────────────
        const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + 30)
        const cutoffStr = cutoff.toISOString().slice(0, 10)

        const plannedSpendTotal = plannedSpends
          .filter(p => p.date >= todayStr && p.date <= cutoffStr)
          .reduce((s, p) => s + toAEDLocal(p.amount, p.currency), 0)

        // ── 5. Projected balance = current + income - remainingBudget - commitments - planned ─
        const projectedBalance = currentBalance + expectedIncome - remainingBudget - monthlyCommitments - plannedSpendTotal
        const netSurplus = projectedBalance - currentBalance

        // ── 6. Day-by-day series for chart ────────────────────────────────────
        // Distribute budget and planned spends across the 30 days
        const dailyBudget = remainingBudget / 30
        const dailyCommitment = monthlyCommitments / 30

        // Map planned spends to their dates
        const plannedByDate = plannedSpends
          .filter(p => p.date >= todayStr && p.date <= cutoffStr)
          .reduce((acc, p) => {
            acc[p.date] = (acc[p.date] ?? 0) + toAEDLocal(p.amount, p.currency)
            return acc
          }, {})

        const dailySeries = []
        let running = currentBalance

        for (let d = 0; d < 30; d++) {
          const date = new Date(today)
          date.setDate(date.getDate() + d)
          const dateStr = date.toISOString().slice(0, 10)

          running += dailyIncome
          running -= dailyBudget
          running -= dailyCommitment
          running -= (plannedByDate[dateStr] ?? 0)

          dailySeries.push({
            day:     d + 1,
            date:    dateStr,
            label:   d === 0 ? 'Today' : d === 29 ? '+30d' : d % 5 === 0 ? `+${d}d` : '',
            balance: Math.round(running),
          })
        }

        return {
          currentBalance,
          projectedBalance,
          expectedIncome,
          remainingBudget,
          monthlyCommitments,
          plannedSpendTotal,
          netSurplus,
          isPositive: netSurplus >= 0,
          dailySeries,
          dailyIncome,
        }
      },


      // ── Capital Allocation — Waterline & Investable Surplus ───────────────
      //
      // baselineLiquidity = (avgMonthlyExpenses + mortgage) * 3
      //   avgMonthlyExpenses = remainingBudget + monthlyCommitments (non-mortgage)
      //   mortgage           = surplusConfig.commitments.adcb_mortgage
      //
      // investableSurplus  = currentBalance - baselineLiquidity
      //   > 0 → "Ready to Invest" — capital above the safety net
      //   < 0 → "Shortfall to Baseline" — not yet at safety net
      //
      // waterlineCrossDay  = day in the 30-day series where projected balance
      //                      first crosses the waterline from below
      //
      // Recalculates dynamically whenever surplusConfig, budgets, or
      // transactions change — all inputs are live store values.
      selectCapitalAllocation() {
        const { surplusConfig, budgets, transactions, fx } = get()
        const projection = get().selectDeterministicProjection()

        const toAEDLocal = (amt, cur) => {
          if (!amt) return 0
          if (!cur || cur === 'AED') return amt
          if (cur === 'USD') return amt * fx.USD_AED
          if (cur === 'INR') return amt * fx.INR_AED
          if (cur === 'SGD') return amt * fx.SGD_AED
          return amt
        }

        // ── Monthly expenses: budget limits + non-mortgage commitments ────────
        const currentMonth = new Date().toISOString().slice(0, 7)
        const budget = budgets.find(b => b.month === currentMonth) ?? budgets[budgets.length - 1]

        const totalBudgetLimit = Object.values(budget?.categories ?? {}).reduce((s, meta) =>
          s + toAEDLocal(meta.limit ?? 0, meta.currency ?? 'AED'), 0
        )

        // Mortgage specifically (anchor for waterline formula)
        const mortgageAED = toAEDLocal(
          surplusConfig.commitments.adcb_mortgage?.amount ?? 0,
          surplusConfig.commitments.adcb_mortgage?.currency ?? 'AED'
        )

        // All other commitments (margin, HSBC etc)
        const otherCommitmentsAED = Object.entries(surplusConfig.commitments)
          .filter(([k]) => k !== 'adcb_mortgage')
          .reduce((s, [, item]) => s + toAEDLocal(item.amount, item.currency), 0)

        const avgMonthlyExpenses = totalBudgetLimit + otherCommitmentsAED

        // ── Baseline: (avgMonthlyExpenses + mortgage) × 3 ────────────────────
        const baselineLiquidity = (avgMonthlyExpenses + mortgageAED) * 3

        // ── Investable surplus ────────────────────────────────────────────────
        const { currentBalance, dailySeries } = projection
        const investableSurplus = currentBalance - baselineLiquidity
        const isAboveWaterline  = investableSurplus >= 0
        const pctOfBaseline     = baselineLiquidity > 0
          ? Math.min((currentBalance / baselineLiquidity) * 100, 200)
          : 0

        // ── Waterline crossing day ────────────────────────────────────────────
        // Find the first day in the projection series where balance >= baseline
        let waterlineCrossDay  = null
        let waterlineCrossDate = null

        if (!isAboveWaterline) {
          for (const point of dailySeries) {
            if (point.balance >= baselineLiquidity) {
              waterlineCrossDay  = point.day
              waterlineCrossDate = point.date
              break
            }
          }
        }

        return {
          baselineLiquidity,
          investableSurplus,
          isAboveWaterline,
          pctOfBaseline,
          waterlineCrossDay,
          waterlineCrossDate,
          avgMonthlyExpenses,
          mortgageAED,
          // Enriched daily series — each point tagged above/below waterline
          enrichedSeries: dailySeries.map(p => ({
            ...p,
            aboveWaterline: p.balance >= baselineLiquidity ? p.balance : null,
            belowWaterline: p.balance < baselineLiquidity  ? p.balance : null,
          })),
        }
      },

      // ── Monthly Average Surplus & Forward Projection ───────────────────────
      // Looks back at ALL transactions (not just current period) to compute
      // the true average monthly surplus across completed months.
      //
      // avgMonthlySurplus = SUM(income - expenses per month) / numMonths
      // projected3M = currentBalance + (avgMonthlySurplus * 3)
      // projected6M = currentBalance + (avgMonthlySurplus * 6)
      selectSurplusProjection() {
        const { transactions, initialBalance, initialBalanceCurrency, periodStart, fx } = get()

        const toAEDLocal = (amt, cur) => {
          if (!amt) return 0
          if (!cur || cur === 'AED') return amt
          if (cur === 'USD') return amt * fx.USD_AED
          if (cur === 'INR') return amt * fx.INR_AED
          if (cur === 'SGD') return amt * fx.SGD_AED
          return amt
        }

        // Only real transactions — no adjustments
        const realTxns = transactions.filter(t =>
          t.type !== 'reconciliation_adjustment' && t.date >= (periodStart ?? '2026-01-01')
        )

        if (realTxns.length === 0) {
          return {
            avgMonthlySurplus: 0,
            monthsOfData: 0,
            projected3M: toAEDLocal(initialBalance, initialBalanceCurrency),
            projected6M: toAEDLocal(initialBalance, initialBalanceCurrency),
            currentBalance: toAEDLocal(initialBalance, initialBalanceCurrency),
            hasData: false,
          }
        }

        // Group by month
        const byMonth = realTxns.reduce((acc, t) => {
          const m = t.date.slice(0, 7)
          if (!acc[m]) acc[m] = { income: 0, expenses: 0 }
          const aed = toAEDLocal(t.amount, t.currency)
          if (aed > 0) acc[m].income   += aed
          else         acc[m].expenses += Math.abs(aed)
          return acc
        }, {})

        const months = Object.keys(byMonth).sort()
        const currentMonth = new Date().toISOString().slice(0, 7)

        // Only use completed months for average (exclude current partial month)
        const completedMonths = months.filter(m => m < currentMonth)
        const numMonths = completedMonths.length || 1

        const totalSurplus = completedMonths.reduce((s, m) =>
          s + (byMonth[m].income - byMonth[m].expenses), 0
        )
        const avgMonthlySurplus = totalSurplus / numMonths

        // Current running balance
        const netChange = realTxns.reduce((s, t) =>
          s + toAEDLocal(t.amount, t.currency), 0
        )
        const currentBalance = toAEDLocal(initialBalance, initialBalanceCurrency) + netChange

        return {
          avgMonthlySurplus,
          monthsOfData: completedMonths.length,
          projected3M: currentBalance + (avgMonthlySurplus * 3),
          projected6M: currentBalance + (avgMonthlySurplus * 6),
          currentBalance,
          hasData: realTxns.length > 0,
          byMonth,
        }
      },

      // ── Historical ledger series for chart ─────────────────────────────────
      // Returns an array of { date, balance } points — one per transaction date.
      // Anchored to initialBalance. Used to draw the historical line on the chart.
      selectLedgerSeries() {
        const { transactions, initialBalance, initialBalanceCurrency, periodStart, fx } = get()

        const toAEDLocal = (amt, cur) => {
          if (!amt) return 0
          if (!cur || cur === 'AED') return amt
          if (cur === 'USD') return amt * fx.USD_AED
          if (cur === 'INR') return amt * fx.INR_AED
          if (cur === 'SGD') return amt * fx.SGD_AED
          return amt
        }

        const startBalance = toAEDLocal(initialBalance, initialBalanceCurrency)
        const start = periodStart ?? new Date().toISOString().slice(0, 7) + '-01'

        // Sort all real transactions chronologically
        const sorted = [...transactions]
          .filter(t => t.type !== 'reconciliation_adjustment' && t.date >= start)
          .sort((a, b) => a.date.localeCompare(b.date))

        if (sorted.length === 0) return []

        // Build day-level series
        const byDate = sorted.reduce((acc, t) => {
          const d = t.date
          acc[d] = (acc[d] ?? 0) + toAEDLocal(t.amount, t.currency)
          return acc
        }, {})

        let running = startBalance
        const series = [{ date: start, balance: startBalance, isStart: true }]

        Object.keys(byDate).sort().forEach(date => {
          running += byDate[date]
          series.push({ date, balance: running })
        })

        return series
      },

      // ── Period Running Balance ─────────────────────────────────────────────
      // Iterates through all transactions from periodStart onwards.
      // Returns: { currentBalance, totalIncome, totalExpenses, netChange, txnCount }
      // All values in AED.
      selectRunningBalance() {
        const { transactions, initialBalance, initialBalanceCurrency, periodStart, fx } = get()

        const startBalance = toAED(initialBalance, initialBalanceCurrency, fx)

        // Filter to period transactions only (excluding adjustments)
        const periodTxns = transactions.filter(t =>
          t.date >= periodStart &&
          t.type !== 'reconciliation_adjustment'
        )

        // Iterate to build running total
        let totalIncome   = 0
        let totalExpenses = 0

        periodTxns.forEach(t => {
          const amtAED = toAED(t.amount, t.currency, fx)
          if (amtAED > 0) totalIncome   += amtAED
          else            totalExpenses += Math.abs(amtAED)
        })

        const netChange      = totalIncome - totalExpenses
        const currentBalance = startBalance + netChange

        return {
          initialBalance:  startBalance,
          currentBalance,
          totalIncome,
          totalExpenses,
          netChange,
          txnCount: periodTxns.length,
          isPositive: netChange >= 0,
        }
      },

      // ── Balance Sheet depth selectors ─────────────────────────────────────

      // Equity in a specific asset = valuation minus linked liability balance (AED)
      selectAssetEquity(assetId) {
        const { assets, liabilities, fx } = get()
        const asset = assets.find(a => a.id === assetId)
        if (!asset) return null
        const valuation = asset.valuationAED ?? 0
        if (!asset.linkedLiabilityId) return { valuation, debt: 0, equity: valuation, ltv: 0 }
        const liab = liabilities.find(l => l.id === asset.linkedLiabilityId)
        if (!liab) return { valuation, debt: 0, equity: valuation, ltv: 0 }
        const debt   = toAED(liab.outstandingBalance ?? 0, liab.currency, fx)
        const equity = valuation - debt
        const ltv    = valuation > 0 ? (debt / valuation) * 100 : 0
        return { valuation, debt, equity, ltv, liability: liab }
      },

      // Linked liability object for an asset (or null)
      selectLinkedLiability(assetId) {
        const { assets, liabilities } = get()
        const asset = assets.find(a => a.id === assetId)
        if (!asset?.linkedLiabilityId) return null
        return liabilities.find(l => l.id === asset.linkedLiabilityId) ?? null
      },

      // Month-over-month net worth change (requires at least one reconciliation log entry)
      selectNetWorthMoM() {
        const { reconciliationLog, netWorth } = get()
        if (!reconciliationLog.length) return null
        // Use the most recent lock date as prior anchor
        const sorted = [...reconciliationLog].sort((a, b) =>
          new Date(b.lockedAt) - new Date(a.lockedAt)
        )
        const lastMonth = sorted[0]?.month
        if (!lastMonth) return null
        // We can't perfectly reconstruct prior NW without snapshots,
        // but we can show the aggregate drift from all reconciliations this month
        const thisMonth = new Date().toISOString().slice(0, 7)
        const monthEntries = reconciliationLog.filter(r => r.month === thisMonth)
        const totalDrift = monthEntries.reduce((s, r) => s + (r.drift ?? 0), 0)
        return { drift: totalDrift, month: thisMonth }
      },

      // ── UI ─────────────────────────────────────────────────────────────────
      setInitialBalance: (amount, currency = 'AED') =>
        set({ initialBalance: amount, initialBalanceCurrency: currency }),
      setPeriodStart: (date) => set({ periodStart: date }),

      addPlannedSpend: (spend) => {
        const item = {
          id:       genId('plan'),
          label:    spend.label    ?? 'Planned spend',
          amount:   Math.abs(spend.amount),  // always positive, always a spend
          currency: spend.currency ?? 'AED',
          date:     spend.date     ?? todayStr(),
          category: spend.category ?? 'other',
          createdAt: nowISO(),
        }
        set(s => ({ plannedSpends: [...s.plannedSpends, item] }))
        return item.id
      },

      removePlannedSpend: (id) => {
        set(s => ({ plannedSpends: s.plannedSpends.filter(p => p.id !== id) }))
      },

      setActiveCurrency: (c)   => set({ activeCurrency: c }),
      setActiveTab:      (t)   => set({ activeTab: t }),
      setOwnerFilter:    (f)   => set({ ownerFilter: f }),

      openFAB:  (ctx = null)   => set({ fabOpen: true,  fabContext: ctx }),
      closeFAB: ()             => set({ fabOpen: false, fabContext: null }),
      setSyncStatus: (status)  => set({ syncStatus: status }),
      setLastSynced: (ts)      => set({ lastSyncedAt: ts }),

      // ── Drive sync stubs ───────────────────────────────────────────────────
      // Drive sync — delegated to useDriveSync hook in App.jsx
      // These stubs remain for backward compatibility; the hook calls gapi directly
      syncToDrive:    async () => { console.log('[Minerva] syncToDrive: use useDriveSync hook') },
      loadFromDrive:  async () => { console.log('[Minerva] loadFromDrive: use useDriveSync hook') },

    }),
    {
      name:    'minerva-v3',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        accounts: s.accounts, assets: s.assets, liabilities: s.liabilities,
        transactions: s.transactions, reconciliationLog: s.reconciliationLog,
        budgets: s.budgets, targets: s.targets, documents: s.documents,
        fx: s.fx, surplusConfig: s.surplusConfig, activeCurrency: s.activeCurrency, ownerFilter: s.ownerFilter, initialBalance: s.initialBalance, initialBalanceCurrency: s.initialBalanceCurrency, periodStart: s.periodStart, plannedSpends: s.plannedSpends, lastSyncedAt: s.lastSyncedAt,
        liveLiquidity: s.liveLiquidity, netWorth: s.netWorth,
      }),
      onRehydrateStorage: () => (state) => { if (state) state._recompute() },
    }
  )
)

