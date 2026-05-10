// src/utils/currency.js
export const CURRENCY_SYMBOLS = { AED: 'AED', USD: 'USD', INR: '₹', SGD: 'SGD' }
export const CURRENCY_LOCALES = { AED: 'en-AE', USD: 'en-US', INR: 'en-IN', SGD: 'en-SG' }

export function fmt(amount, currency = 'AED', options = {}) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—'
  const abs  = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (options.compact) {
    let val, suffix
    if (abs >= 1_000_000)      { val = abs / 1_000_000; suffix = 'M' }
    else if (abs >= 1_000)     { val = abs / 1_000;     suffix = 'K' }
    else                       { val = abs;              suffix = '' }
    const formatted = suffix ? `${val.toFixed(val >= 10 ? 1 : 2)}${suffix}` : val.toFixed(0)
    return `${sign}${CURRENCY_SYMBOLS[currency] || currency} ${formatted}`
  }
  const decimals  = options.decimals ?? 0
  const formatted = abs.toLocaleString(CURRENCY_LOCALES[currency] || 'en-US', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  })
  return `${sign}${CURRENCY_SYMBOLS[currency] || currency} ${formatted}`
}

export function pct(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export { daysUntil, formatDate, currentMonth, monthLabel } from './dates.js'
