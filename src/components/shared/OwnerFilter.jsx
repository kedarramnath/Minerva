// src/components/shared/OwnerFilter.jsx
// Persistent owner filter — Kedar · Anisha · Family · All
// Silver Slate (#CBD5E1) active state to match logo colour scheme

import { useMinervaStore } from '../../state/store.js'

const FILTERS = [
  { id: 'all',    label: 'All'    },
  { id: 'Kedar',  label: 'Kedar'  },
  { id: 'Anisha', label: 'Anisha' },
  { id: 'Family', label: 'Family' },
]

const COLORS = {
  all:    { active: 'bg-white/15 text-white',           inactive: 'text-white/35' },
  Kedar:  { active: 'bg-blue-lt/20 text-blue-lt',       inactive: 'text-white/35' },
  Anisha: { active: 'bg-sage-lt/20 text-sage-lt',       inactive: 'text-white/35' },
  Family: { active: 'bg-[#CBD5E1]/20 text-[#CBD5E1]',   inactive: 'text-white/35' },
}

export function OwnerFilter() {
  const ownerFilter   = useMinervaStore(s => s.ownerFilter)
  const setOwnerFilter = useMinervaStore(s => s.setOwnerFilter)

  return (
    <div className="flex items-center bg-white/8 rounded-xl p-0.5 gap-0.5">
      {FILTERS.map(f => {
        const active = ownerFilter === f.id
        const colors = COLORS[f.id]
        return (
          <button
            key={f.id}
            onClick={() => setOwnerFilter(f.id)}
            className={`
              flex-1 py-1.5 px-2 rounded-[9px] text-[10px] font-mono font-medium
              tracking-wide transition-all duration-150 active:scale-[0.97]
              ${active ? colors.active : colors.inactive}
            `}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
