// src/components/BottomNav.jsx
import { LayoutDashboard, Scale, PieChart, Target, FolderOpen } from 'lucide-react'
import { useMinervaStore } from '../state/store.js'

const TABS = [
  { id: 'dashboard',    label: 'Dashboard',  Icon: LayoutDashboard },
  { id: 'balancesheet', label: 'Balance',    Icon: Scale           },
  { id: 'budgets',      label: 'Budgets',    Icon: PieChart        },
  { id: 'planning',     label: 'Planning',   Icon: Target          },
  { id: 'documents',    label: 'Documents',  Icon: FolderOpen      },
]

export function BottomNav() {
  const activeTab  = useMinervaStore(s => s.activeTab)
  const setActiveTab = useMinervaStore(s => s.setActiveTab)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-border">
      <div className="flex items-center justify-around px-2 py-2 pb-safe">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl transition-all
                ${active ? 'text-navy' : 'text-muted'}`}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.8}
                className={`transition-all ${active ? 'text-navy' : 'text-muted'}`}
              />
              <span className={`text-[10px] font-mono transition-all ${active ? 'font-semibold text-navy' : 'text-muted'}`}>
                {label}
              </span>
              {active && (
                <div className="absolute top-0 w-8 h-0.5 bg-navy rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
