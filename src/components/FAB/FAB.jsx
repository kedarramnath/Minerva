import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useMinervaStore } from '../../state/store.js'
import { FABModal } from './FABModal.jsx'

const FAB_CONTEXTS = {
  dashboard: { color: 'bg-navy', label: 'Log Transaction' },
  balancesheet: { color: 'bg-teal', label: 'Update Valuation' },
  budgets: { color: 'bg-amber', label: 'Set Budget' },
  planning: { color: 'bg-sage', label: 'Add Milestone' },
  documents: { color: 'bg-blue', label: 'Add Document' },
}

export function FAB() {
  const activeTab  = useMinervaStore(s => s.activeTab)
  const fabOpen    = useMinervaStore(s => s.fabOpen)
  const fabContext = useMinervaStore(s => s.fabContext)
  const openFAB    = useMinervaStore(s => s.openFAB)
  const closeFAB   = useMinervaStore(s => s.closeFAB)

  const [menuOpen, setMenuOpen] = useState(false)

  const ctx = FAB_CONTEXTS[activeTab] ?? FAB_CONTEXTS.dashboard

  const handleFABTap = () => {
    if (fabOpen) { closeFAB(); setMenuOpen(false); return }
    if (activeTab === 'dashboard') {
      setMenuOpen(m => !m)
    } else {
      openFAB(activeTab)
    }
  }

  const handleOption = (context) => {
    setMenuOpen(false)
    openFAB(context)
  }

  return (
    <>
      {/* Backdrop for menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      )}

      {/* Expanded menu options */}
      {menuOpen && (
        <div className="fixed bottom-28 right-4 z-50 flex flex-col items-end gap-2">
          <button onClick={() => handleOption('reconcile')}
            className="flex items-center gap-2 bg-sage text-white text-xs font-mono font-medium px-4 py-2.5 rounded-2xl shadow-lg active:scale-95 transition-all whitespace-nowrap">
            <span>⚖️</span> Reconcile
          </button>
          <button onClick={() => handleOption('import')}
            className="flex items-center gap-2 bg-teal text-white text-xs font-mono font-medium px-4 py-2.5 rounded-2xl shadow-lg active:scale-95 transition-all whitespace-nowrap">
            <span>📂</span> Import Statement
          </button>
          <button onClick={() => handleOption('dashboard')}
            className="flex items-center gap-2 bg-navy text-white text-xs font-mono font-medium px-4 py-2.5 rounded-2xl shadow-lg active:scale-95 transition-all whitespace-nowrap">
            <span>✏️</span> Log Transaction
          </button>
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={handleFABTap}
        className={`fixed bottom-24 right-4 z-50 w-14 h-14 rounded-2xl shadow-fab flex items-center justify-center transition-all duration-200 active:scale-95 ${ctx.color} text-white`}
      >
        {fabOpen
          ? <X size={22} strokeWidth={2.5} />
          : menuOpen
            ? <X size={22} strokeWidth={2.5} />
            : <Plus size={24} strokeWidth={2.5} />
        }
      </button>

      {/* Modal */}
      {fabOpen && <FABModal context={fabContext || activeTab} onClose={() => { closeFAB(); setMenuOpen(false) }} />}
    </>
  )
}
