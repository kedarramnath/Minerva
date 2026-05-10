// src/App.jsx
import { useState }             from 'react'
import { useMinervaStore }      from './state/store.js'
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

function SyncBadge({ status, lastSyncedAt, onSignIn }) {
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null

  const label = {
    idle:    '☁️ Synced',
    syncing: '↻ Syncing…',
    error:   '⚠️ Sync error',
    offline: '○ Offline',
  }[status] ?? '○ Not connected'

  const color = {
    idle:    'text-sage/80',
    syncing: 'text-blue/80',
    error:   'text-rose/80',
    offline: 'text-muted',
  }[status] ?? 'text-muted'

  return (
    <button
      onClick={status === 'idle' ? undefined : onSignIn}
      className={`fixed top-4 right-4 z-20 text-[9px] font-mono px-2 py-1 bg-surface/80 backdrop-blur rounded-lg border border-border shadow-sm ${color}`}
    >
      {label}
    </button>
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
  const [hawkTarget, setHawkTarget] = useState(null)

  // Drive sync — initialises on mount, subscribes to mutations
  const { signIn } = useDriveSync()

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

      {/* Sync badge — top right, unobtrusive */}
      <SyncBadge
        status={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onSignIn={signIn}
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
