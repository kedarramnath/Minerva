// src/components/shared/Card.jsx
export function Card({ children, className = '', onClick }) {
  const base = 'bg-surface rounded-2xl shadow-card border border-border'
  const interactive = onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
  return (
    <div className={`${base} ${interactive} ${className}`} onClick={onClick}>
      {children}
    </div>
  )
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-sm font-semibold text-navy tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted mt-0.5 font-mono">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Pill({ label, color = 'blue' }) {
  const colors = {
    blue:  'bg-blue-lt text-blue',
    sage:  'bg-sage-lt text-sage',
    amber: 'bg-amber-lt text-amber',
    rose:  'bg-rose-lt text-rose',
    teal:  'bg-teal-lt text-teal',
    navy:  'bg-navy text-white',
    muted: 'bg-border text-muted',
  }
  return (
    <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${colors[color] || colors.muted}`}>
      {label}
    </span>
  )
}

export function StatRow({ label, value, valueClass = 'text-slate' }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-xs font-mono font-medium ${valueClass}`}>{value}</span>
    </div>
  )
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-sm font-medium text-slate">{title}</p>
      {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
    </div>
  )
}
