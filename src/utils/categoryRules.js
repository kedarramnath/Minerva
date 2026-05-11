// src/utils/categoryRules.js
// Rule-based transaction categorisation engine
// Rules are keyword → category mappings, applied to transaction descriptions
// Priority: exact match first, then keyword match, then default

export const CATEGORIES = {
  groceries:     { label: 'Groceries',      icon: '🛒', color: 'sage'  },
  dining:        { label: 'Dining Out',      icon: '🍽️', color: 'amber' },
  transport:     { label: 'Transport',       icon: '🚗', color: 'blue'  },
  utilities:     { label: 'Utilities',       icon: '💡', color: 'teal'  },
  healthcare:    { label: 'Healthcare',      icon: '🏥', color: 'rose'  },
  kids:          { label: 'Kids',            icon: '👶', color: 'pink'  },
  shopping:      { label: 'Shopping',        icon: '🛍️', color: 'purple'},
  entertainment: { label: 'Entertainment',   icon: '🎭', color: 'indigo'},
  fitness:       { label: 'Fitness',         icon: '💪', color: 'green' },
  beauty:        { label: 'Beauty & Care',   icon: '💅', color: 'rose'  },
  home:          { label: 'Home & Living',   icon: '🏠', color: 'amber' },
  travel:        { label: 'Travel',          icon: '✈️', color: 'blue'  },
  investment:    { label: 'Investment',      icon: '📈', color: 'navy'  },
  transfer:      { label: 'Transfer',        icon: '↔️', color: 'muted' },
  salary:        { label: 'Salary',          icon: '💰', color: 'sage'  },
  mortgage:      { label: 'Mortgage / EMI',  icon: '🏦', color: 'navy'  },
  domestic:      { label: 'Domestic Help',   icon: '🧹', color: 'teal'  },
  fees:          { label: 'Fees & Charges',  icon: '📋', color: 'muted' },
  charity:       { label: 'Charity',         icon: '🤲', color: 'sage'  },
  other:         { label: 'Other',           icon: '📦', color: 'muted' },
}

// Keyword rules — ordered by priority (first match wins)
// Each entry: { keywords: [...], category, exact? }
// exact: true = must match full description (case-insensitive)
// exact: false (default) = description must CONTAIN keyword

const RULES = [

  // ── Salary & Income ────────────────────────────────────────────────────────
  { keywords: ['salary','montfort'], category: 'salary' },

  // ── Mortgage / Loan ────────────────────────────────────────────────────────
  { keywords: ['loanrecovery','loan recovery','emi','mortgage'], category: 'mortgage' },

  // ── Transfers (internal) ───────────────────────────────────────────────────
  { keywords: ['credit repayment','transfer','trf out','trf in','sent from wio','sent from','own account','to kedar','to anisha','internet banking','ibaa','ibab','ibac','ibaj','fixed saving space','living expenses fund','monthly expenses fund','yuvi','family account','joint current'], category: 'transfer' },

  // ── Investment ─────────────────────────────────────────────────────────────
  { keywords: ['dividend','debit interest capitalized','interest payout','interest credit','interest applied','subs allianz','subs frnkl','subs blc','early withdrawal interest'], category: 'investment' },

  // ── Groceries ─────────────────────────────────────────────────────────────
  { keywords: ['spinneys','lulu hypermarket','lulu','carrefour','choithram','nesto','al adil','shree durgas','plus point exp','oqaryah','bayara world','jackson trading'], category: 'groceries' },

  // ── Dining ────────────────────────────────────────────────────────────────
  { keywords: ['restaurant','din tai fung','carluccios','arabian tea house','hurricanes grill','dusit thani','hafiz mustafa','costa coffee','bread ahead','vibe cafe','mapleberry','mount everest restaur','shubh shagun','bosporus','the lounge','venchi','jollibee','cold stone','french bakery','doner & gyros','sangeetha','subshop','il forno','pos il forno','lde kitchen','kayan al khair','mons hospitality','bait uldana','we asian food','ya kun','toast box','tai cheong','bengawan','yuchi cafe','catering','kiosk','noqodi gv','headout','gogetit','pos desert chill','emerald hospitality','nguyen cimit','pos shawarmary','r and b','rand b'], category: 'dining' },

  // ── Transport ─────────────────────────────────────────────────────────────
  { keywords: ['careem','dubai taxi','arabia taxi','national taxi','cars taxi','rta','road & transport','comfort/citycab','easy taxi','mawgif','parking'], category: 'transport' },

  // ── Utilities ─────────────────────────────────────────────────────────────
  { keywords: ['dubai electricity','dewa','du apple pay','du telecom',' du ','enoc','adnoc','mobimatter','tel ','cca salsabeel'], category: 'utilities' },

  // ── Healthcare ────────────────────────────────────────────────────────────
  { keywords: ['mediclinic','supercare pharmacy','super care pharmacy','alphamed','feetlab','chemist warehouse','life phy','cashiering office','myorganicapps','myaster'], category: 'healthcare' },

  // ── Kids ──────────────────────────────────────────────────────────────────
  { keywords: ['mumzworld','little giggles','sa headway','baby loves','kinokuniya','noon food','noon'], category: 'kids' },

  // ── Fitness ───────────────────────────────────────────────────────────────
  { keywords: ['gymnation','fitness first','urbanclap','ureka sloan'], category: 'fitness' },

  // ── Beauty & Care ─────────────────────────────────────────────────────────
  { keywords: ['paparazzi salon','parffragrance'], category: 'beauty' },

  // ── Home & Living ─────────────────────────────────────────────────────────
  { keywords: ['ikea','royaloak','home box','dpem','nomod allied pest','pest con','amazon'], category: 'home' },

  // ── Shopping ──────────────────────────────────────────────────────────────
  { keywords: ['athlet co','adidas','vans','fitflop','ovs','uniqlo','iznish fashion','lril','mom store','noor abbas','crossword','www pimpedwatches','temu','miniso','tiger','black fortune','tabby','footlocker','controlled model','desco','konci trading','dudu trading','talabat','paymob','new mart','maids cc'], category: 'shopping' },

  // ── Entertainment ─────────────────────────────────────────────────────────
  { keywords: ['platinumlist','emirates leisure','meraas','kenkoh','global village','let','leto','ezpz','yamanote'], category: 'entertainment' },

  // ── Travel ────────────────────────────────────────────────────────────────
  { keywords: ['emirates airlines','emirates','united airlines','dubai duty free','foreign exchange fee','carlton hotel','tmef'], category: 'travel' },

  // ── Domestic ──────────────────────────────────────────────────────────────
  { keywords: ['maids cc','domestic workers','clement gerard'], category: 'domestic' },

  // ── Fees ──────────────────────────────────────────────────────────────────
  { keywords: ['foreign exchange fee','vat on processing','issuer dcc','stnd proc','processing fee'], category: 'fees' },
]

// ── Apply rules to a description ──────────────────────────────────────────────

export function categorise(description) {
  if (!description) return 'other'
  const d = description.toLowerCase()

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (d.includes(kw.toLowerCase())) {
        return rule.category
      }
    }
  }
  return 'other'
}

// ── Categorise a transaction object ───────────────────────────────────────────

export function categoriseTransaction(txn) {
  // Already categorised and not 'other' or 'imported' — keep it
  if (txn.category && txn.category !== 'other' && txn.category !== 'imported') {
    return txn.category
  }
  // Income transactions
  if (txn.amount > 0) {
    const d = (txn.description || '').toLowerCase()
    if (d.includes('salary')) return 'salary'
    if (d.includes('dividend') || d.includes('interest')) return 'investment'
    if (d.includes('credit repayment') || d.includes('transfer')) return 'transfer'
    return 'transfer' // most positive amounts are transfers/refunds
  }
  return categorise(txn.description)
}

// ── Re-categorise all transactions in store ───────────────────────────────────

export function recategoriseAll(transactions) {
  return transactions.map(txn => ({
    ...txn,
    category: categoriseTransaction(txn),
  }))
}
