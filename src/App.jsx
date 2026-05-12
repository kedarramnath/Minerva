// src/App.jsx
import { useState, useEffect }  from 'react'
import { useMinervaStore }      from './state/store.js'
import { ProcessingOverlay, SyncStatusBar, DashboardSkeleton } from './components/shared/LoadingState.jsx'
import { useDriveFolderSync } from './hooks/useDriveFolderSync.js'
import { useDriveSync }         from './hooks/useDriveSync.js'
import { BottomNav }            from './components/BottomNav.jsx'
import { FAB }                  from './components/FAB/FAB.jsx'
import { Dashboard }            from './modules/Dashboard/index.jsx'
import { BalanceSheet }         from './modules/BalanceSheet/index.jsx'
import { Budgets }              from './modules/Budgets/index.jsx'
import { Planning }             from './modules/Planning/index.jsx'
import { Documents }            from './modules/Documents/index.jsx'
import { OpeningBalances }      from './modules/Reconciliation/OpeningBalances.jsx'
import { ReconcileFlow }        from './modules/Reconciliation/ReconcileFlow.jsx'

const SCREENS = {
  dashboard:    Dashboard,
  balancesheet: BalanceSheet,
  budgets:      Budgets,
  planning:     Planning,
}

// ─── Sync status indicator ────────────────────────────────────────────────────

function SyncBadge({ status, onSyncVault }) {
  // Only show sync status when syncing or error — hide when idle to avoid distraction
  const showStatus = status === 'syncing' || status === 'error'
  const color = { syncing: 'text-blue/80', error: 'text-rose/80' }[status] ?? 'text-muted'
  const label = { syncing: '↻ Syncing…', error: '⚠️ Sync error' }[status] ?? ''

  return (
    <div className="fixed top-4 right-4 z-20 flex items-center gap-1.5">
      <button
        onClick={onSyncVault}
        className="text-[9px] font-mono px-2 py-1 bg-surface/80 backdrop-blur rounded-lg border border-border shadow-sm text-teal/80 active:scale-95 transition-all"
      >
        🗂 Vault
      </button>
      {showStatus && (
        <span className={`text-[9px] font-mono px-2 py-1 bg-surface/80 backdrop-blur rounded-lg border border-border shadow-sm ${color}`}>
          {label}
        </span>
      )}
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const activeTab    = useMinervaStore(s => s.activeTab)
  const setActiveTab = useMinervaStore(s => s.setActiveTab)
  const accounts     = useMinervaStore(s => s.accounts)
  const syncStatus   = useMinervaStore(s => s.syncStatus)
  const lastSyncedAt = useMinervaStore(s => s.lastSyncedAt)

  const [modal, setModal]           = useState(null) // null | 'opening' | 'reconcile'
  const [isLoading, setIsLoading]   = useState(true)

  // Brief loading state on first mount
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800)
    return () => clearTimeout(t)
  }, [])
  const [hawkTarget, setHawkTarget] = useState(null)

  // Drive sync — initialises on mount, subscribes to mutations
  const { } = useDriveSync()
  const { syncDocuments }              = useDriveFolderSync()

  const noneAnchored    = accounts.every(a => !a.reconciledAt)
  const showSetupBanner = noneAnchored && modal === null

  const handleNavigateToAsset = (id, type) => {
    setHawkTarget({ id, type })
    setActiveTab('dashboard')
    setTimeout(() => setHawkTarget(null), 100)
  }

  const Screen = SCREENS[activeTab] || Dashboard

  return (
    <div className="min-h-screen bg-alabaster font-sans overflow-x-hidden">

      {/* Sync status bar */}
      <SyncStatusBar />

      {/* Processing overlay */}
      <ProcessingOverlay
        show={syncStatus === 'syncing' && isLoading}
        message="Loading Minerva…"
      />

      {/* Sync badge — top right, unobtrusive */}
      <SyncBadge
        status={syncStatus}
        onSyncVault={syncDocuments}
      />

      {/* Modals */}
      {modal === 'opening' && (
        <div className="fixed inset-0 z-50 bg-alabaster overflow-y-auto">
          <OpeningBalances onDone={() => setModal(null)} />
        </div>
      )}
      {modal === 'reconcile' && (
        <div className="fixed inset-0 z-50 bg-alabaster overflow-y-auto">
          <ReconcileFlow onClose={() => setModal(null)} />
        </div>
      )}

      {/* Main */}
      <main className="max-w-lg mx-auto relative">

        {/* First-run banner */}
        {showSetupBanner && (
          <div className="mx-4 mt-4 bg-amber-lt border border-amber/25 rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber">Setup required</p>
              <p className="text-[10px] font-mono text-amber/70 mt-0.5">Enter opening balances to activate tracking</p>
            </div>
            <button
              onClick={() => setModal('opening')}
              className="flex-shrink-0 ml-3 px-3 py-1.5 bg-amber text-white text-xs font-semibold rounded-xl active:scale-95 transition-all"
            >
              Set Up →
            </button>
          </div>
        )}

        {/* Active screen */}
        {activeTab === 'documents'
          ? <Documents onNavigateToAsset={handleNavigateToAsset} />
          : <Screen onOpenReconcile={() => setModal('reconcile')} />
        }
      </main>

      {/* Fixed chrome */}
      {modal === null && <BottomNav />}
      {modal === null && <FAB />}
    </div>
  )
}
