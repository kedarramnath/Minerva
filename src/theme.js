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
  current:      { bg: 'bg-blue-lt', text: 'text-blue', dot: 'bg-blue' },
  savings:      { bg: 'bg-sage-lt', text: 'text-sage', dot: 'bg-sage' },
  credit_card:  { bg: 'bg-rose-lt', text: 'text-rose', dot: 'bg-rose' },
  investment:   { bg: 'bg-amber-lt', text: 'text-amber', dot: 'bg-amber' },
  fixed_deposit:{ bg: 'bg-teal-lt', text: 'text-teal', dot: 'bg-teal' },
  pension:      { bg: 'bg-navy-lt text-white', text: 'text-white', dot: 'bg-white' },
  mortgage:     { bg: 'bg-rose-lt', text: 'text-rose', dot: 'bg-rose' },
}

export const COUNTRY_FLAGS = {
  UAE:       '🇦🇪',
  India:     '🇮🇳',
  USA:       '🇺🇸',
  Singapore: '🇸🇬',
}

export const CATEGORY_META = {
  groceries:     { label: 'Groceries',     icon: '🛒',  color: 'sage'  },
  dining:        { label: 'Dining',        icon: '🍽️',  color: 'amber' },
  travel:        { label: 'Travel',        icon: '✈️',  color: 'blue'  },
  school:        { label: 'School',        icon: '📚',  color: 'navy'  },
  utilities:     { label: 'Utilities',     icon: '💡',  color: 'teal'  },
  medical:       { label: 'Medical',       icon: '🏥',  color: 'rose'  },
  entertainment: { label: 'Entertainment', icon: '🎬',  color: 'amber' },
  household:     { label: 'Household',     icon: '🏠',  color: 'sage'  },
  transfers:     { label: 'Transfers',     icon: '↔️',  color: 'muted' },
  investments:   { label: 'Investments',   icon: '📈',  color: 'navy'  },
  other:         { label: 'Other',         icon: '📦',  color: 'muted' },
  salary:        { label: 'Salary',        icon: '💰',  color: 'sage'  },
  rental:        { label: 'Rental Income', icon: '🏘️',  color: 'sage'  },
  dividends:     { label: 'Dividends',     icon: '📊',  color: 'blue'  },
}
