// src/components/FAB/FAB.jsx
import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useMinervaStore } from '../../state/store.js'
import { FABModal } from './FABModal.jsx'

export function FAB() {
  const activeTab   = useMinervaStore(s => s.activeTab)
  const fabOpen     = useMinervaStore(s => s.fabOpen)
  const openFAB     = useMinervaStore(s => s.openFAB)
  const closeFAB    = useMinervaStore(s => s.closeFAB)

  const TAB_CONTEXT = {
    dashboard:    { label: 'Log Transaction', color: 'bg-navy' },
    balancesheet: { label: 'Update Valuation', color: 'bg-sage' },
    budgets:      { label: 'Adjust Budget',   color: 'bg-amber' },
    planning:     { label: 'Log Milestone',   color: 'bg-teal' },
    documents:    { label: 'Add Document',    color: 'bg-blue'  },
  }

  const ctx = TAB_CONTEXT[activeTab] || TAB_CONTEXT.dashboard

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => fabOpen ? closeFAB() : openFAB(activeTab)}
        className={`
          fixed bottom-24 right-4 z-50
          w-14 h-14 rounded-2xl shadow-fab
          flex items-center justify-center
          transition-all duration-200 active:scale-95
          ${ctx.color} text-white
        `}
        aria-label={ctx.label}
      >
        {fabOpen
          ? <X size={22} strokeWidth={2.5} />
          : <Plus size={24} strokeWidth={2.5} />
        }
      </button>

      {/* Context label that appears on long-press area */}
      {!fabOpen && (
        <div className="fixed bottom-[104px] right-[72px] z-40 pointer-events-none">
          <span className="text-[10px] font-mono text-muted bg-surface border border-border rounded-lg px-2 py-1 shadow-sm whitespace-nowrap opacity-0">
            {ctx.label}
          </span>
        </div>
      )}

      {/* Backdrop */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-sm"
          onClick={closeFAB}
        />
      )}

      {/* Adaptive Modal */}
      {fabOpen && <FABModal context={activeTab} onClose={closeFAB} />}
    </>
  )
}
