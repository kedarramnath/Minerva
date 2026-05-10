// src/components/shared/CurrencyToggle.jsx
import { useMinervaStore } from '../../state/store.js'

const CURRENCIES = ['AED', 'USD', 'INR']

export function CurrencyToggle() {
  const activeCurrency = useMinervaStore(s => s.activeCurrency)
  const setActiveCurrency = useMinervaStore(s => s.setActiveCurrency)

  return (
    <div className="flex items-center bg-alabaster rounded-xl p-0.5 gap-0.5">
      {CURRENCIES.map(c => (
        <button
          key={c}
          onClick={() => setActiveCurrency(c)}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all
            ${activeCurrency === c
              ? 'bg-navy text-white shadow-sm'
              : 'text-muted hover:text-slate'
            }
          `}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
