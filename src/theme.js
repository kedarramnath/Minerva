// src/theme.js — Minerva design tokens
export const COLORS = {
  navy:     '#0A2342',
  navyLt:   '#1A3A5C',
  blue:     '#4A7FA5',
  blueLt:   '#D6E8F5',
  sage:     '#4A8C6F',
  sageLt:   '#D6EDE4',
  amber:    '#B07D2A',
  amberLt:  '#FEF6E4',
  rose:     '#A05252',
  roseLt:   '#F5E0E0',
  teal:     '#2A7D8C',
  tealLt:   '#D6EEF2',
  alabaster:'#F8F9FA',
  surface:  '#FFFFFF',
  border:   '#E2E8F0',
  muted:    '#6B7A8D',
  slate:    '#4A5568',
}

export const ACCOUNT_TYPE_COLORS = {
  current:      { bg: 'bg-blue-lt',  text: 'text-blue',  dot: 'bg-blue'  },
  savings:      { bg: 'bg-sage-lt',  text: 'text-sage',  dot: 'bg-sage'  },
  credit_card:  { bg: 'bg-rose-lt',  text: 'text-rose',  dot: 'bg-rose'  },
  investment:   { bg: 'bg-amber-lt', text: 'text-amber', dot: 'bg-amber' },
  fixed_deposit:{ bg: 'bg-teal-lt',  text: 'text-teal',  dot: 'bg-teal'  },
  pension:      { bg: 'bg-navy-lt text-white', text: 'text-white', dot: 'bg-white' },
  mortgage:     { bg: 'bg-rose-lt',  text: 'text-rose',  dot: 'bg-rose'  },
}

export const COUNTRY_FLAGS = {
  UAE:       '🇦🇪',
  India:     '🇮🇳',
  USA:       '🇺🇸',
  Singapore: '🇸🇬',
}

// Single source of truth for all transaction categories
// Used by: Budgets, Dashboard burn rate, categoryRules auto-tagger
export const CATEGORY_META = {
  // ── Income ────────────────────────────────────────────────────────────────
  salary:        { label: 'Salary',          icon: '💰', color: 'sage'  },
  dividends:     { label: 'Dividends',       icon: '📊', color: 'blue'  },
  investments:   { label: 'Investments',     icon: '📈', color: 'navy'  },

  // ── Daily Spend ───────────────────────────────────────────────────────────
  groceries:     { label: 'Groceries',       icon: '🛒', color: 'sage'  },
  dining:        { label: 'Dining',          icon: '🍽️', color: 'amber' },
  transport:     { label: 'Transport',       icon: '🚗', color: 'blue'  },
  utilities:     { label: 'Utilities',       icon: '💡', color: 'teal'  },

  // ── Family & Home ─────────────────────────────────────────────────────────
  household:     { label: 'Household',       icon: '🏠', color: 'sage'  },
  kids:          { label: 'Kids',            icon: '👶', color: 'teal'  },
  domestic:      { label: 'Domestic Help',   icon: '🧹', color: 'teal'  },

  // ── Lifestyle ─────────────────────────────────────────────────────────────
  shopping:      { label: 'Shopping',        icon: '🛍️', color: 'amber' },
  entertainment: { label: 'Entertainment',   icon: '🎬', color: 'amber' },
  fitness:       { label: 'Fitness',         icon: '💪', color: 'sage'  },
  travel:        { label: 'Travel',          icon: '✈️', color: 'blue'  },

  // ── Health ────────────────────────────────────────────────────────────────
  medical:       { label: 'Medical',         icon: '🏥', color: 'rose'  },

  // ── Finance ───────────────────────────────────────────────────────────────
  mortgage:      { label: 'Mortgage / EMI',  icon: '🏦', color: 'navy'  },
  transfers:     { label: 'Transfers',       icon: '↔️', color: 'muted' },
  fees:          { label: 'Fees & Charges',  icon: '📋', color: 'muted' },

  // ── Fallback ──────────────────────────────────────────────────────────────
  other:         { label: 'Other',           icon: '📦', color: 'muted' },
}
