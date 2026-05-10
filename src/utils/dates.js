export function daysUntil(dateStr) {
  const target = new Date(dateStr)
  const today  = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24))
}
export function formatDate(dateStr, style = 'medium') {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (style === 'short')  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  if (style === 'medium') return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  if (style === 'month')  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  return dateStr
}
export function currentMonth() { return new Date().toISOString().slice(0, 7) }
export function monthLabel(m) {
  const [y, mo] = m.split('-')
  return new Date(y, parseInt(mo)-1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
