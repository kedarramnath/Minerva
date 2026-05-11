import { useState, useEffect, useMemo } from 'react'
import { useMinervaStore }              from '../../state/store.js'

// ─── Smart auto-categorisation ────────────────────────────────────────────────
// Based on document title keywords, not folder structure

const CATEGORIES = {
  identity:   { label: 'Identity',    icon: '🪪', color: 'blue',  bg: 'bg-blue-lt/50',   border: 'border-blue/20',   text: 'text-blue'  },
  banking:    { label: 'Banking',     icon: '🏦', color: 'teal',  bg: 'bg-teal/10',      border: 'border-teal/20',   text: 'text-teal'  },
  investment: { label: 'Investments', icon: '📊', color: 'sage',  bg: 'bg-sage-lt/50',   border: 'border-sage/20',   text: 'text-sage'  },
  property:   { label: 'Property',    icon: '🏠', color: 'amber', bg: 'bg-amber-lt/50',  border: 'border-amber/20',  text: 'text-amber' },
  corporate:  { label: 'Corporate',   icon: '🏢', color: 'navy',  bg: 'bg-navy/8',       border: 'border-navy/15',   text: 'text-navy'  },
  legal:      { label: 'Legal',       icon: '⚖️', color: 'rose',  bg: 'bg-rose-lt/50',   border: 'border-rose/20',   text: 'text-rose'  },
  tax:        { label: 'Tax',         icon: '📋', color: 'muted', bg: 'bg-alabaster',    border: 'border-border',    text: 'text-muted' },
  other:      { label: 'Other',       icon: '📁', color: 'muted', bg: 'bg-alabaster',    border: 'border-border',    text: 'text-muted' },
}

// Keyword → category mapping
const KEYWORD_MAP = [
  { cat: 'identity',   words: ['passport','emirates id','eid','visa','aadhaar','aadhar','pan card','birth cert','marriage cert','national id','identity','driving licence','driver'] },
  { cat: 'banking',    words: ['statement','bank','adcb','hsbc','wio','enbd','emirates nbd','sbi','hdfc','axis bank','dbs','chase','amex','amazon','m&t','airwallex','account'] },
  { cat: 'investment', words: ['ibkr','interactive brokers','portfolio','fcnr','fixed deposit','fd','dews','realty mogul','reit','nav','fund','statement','investment','shares','equity','dividend'] },
  { cat: 'property',   words: ['title deed','oqood','sale agreement','noc','possession','valuation','mortgage','villa','apartment','penthouse','warehouse','windy meadow','supply row','matunga','waters edge','bhor','rajghar','darjeeling'] },
  { cat: 'corporate',  words: ['llc','pte','fzco','ltd','limited','shareholders','memorandum','articles','incorporation','trade licence','cr','ikarma','kyck','infinity','vista','montfort'] },
  { cat: 'legal',      words: ['agreement','contract','power of attorney','poa','court','eviction','lien','sblc','insurance','policy','will','affidavit','notary'] },
  { cat: 'tax',        words: ['tax','vat','gst','return','assessment','tds','itr','tin'] },
]

function smartCategory(title, existingCategory) {
  if (existingCategory && existingCategory !== 'other' && CATEGORIES[existingCategory]) {
    return existingCategory
  }
  const lower = (title ?? '').toLowerCase()
  for (const { cat, words } of KEYWORD_MAP) {
    if (words.some(w => lower.includes(w))) return cat
  }
  return 'other'
}

// ─── Recency grouping ─────────────────────────────────────────────────────────

function getRecencyGroup(dateStr) {
  if (!dateStr) return 'Older'
  const date = new Date(dateStr)
  const now  = new Date()
  const diff = (now - date) / (1000 * 60 * 60 * 24)
  if (diff < 1)  return 'Today'
  if (diff < 7)  return 'This Week'
  if (diff < 30) return 'This Month'
  return 'Older'
}

// ─── Category Tile ────────────────────────────────────────────────────────────

function CategoryTile({ catKey, meta, count, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-2xl border transition-all active:scale-95 ${
        isActive ? `${meta.bg} ${meta.border} shadow-sm` : 'bg-surface border-border'
      }`}
    >
      <span className="text-2xl mb-1">{meta.icon}</span>
      <span className={`text-[9px] font-mono font-medium ${isActive ? meta.text : 'text-muted'}`}>
        {meta.label}
      </span>
      <span className={`text-[9px] font-mono mt-0.5 ${isActive ? meta.text : 'text-muted/60'}`}>
        {count}
      </span>
    </button>
  )
}

// ─── Tag Cloud ────────────────────────────────────────────────────────────────

function TagCloud({ allTags, activeTags, onToggle }) {
  if (!allTags.length) return null
  return (
    <div className="flex gap-1.5 flex-wrap">
      {allTags.map(tag => {
        const active = activeTags.includes(tag)
        return (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium border transition-all active:scale-95 ${
              active ? 'bg-navy text-white border-navy' : 'bg-surface text-muted border-border'
            }`}
          >
            {tag}
          </button>
        )
      })}
    </div>
  )
}

// ─── Document Card ────────────────────────────────────────────────────────────

function DocCard({ doc, catMeta, onTagClick, onAddTag }) {
  const [showTagInput, setShowTagInput] = useState(false)
  const [newTag, setNewTag]             = useState('')
  const addDocument                     = useMinervaStore(s => s.addDocument)
  const documents                       = useMinervaStore(s => s.documents)

  const handleAddTag = () => {
    const t = newTag.trim()
    if (!t) return
    // Update document tags in store
    const updated = documents.map(d =>
      d.id === doc.id ? { ...d, tags: [...new Set([...(d.tags ?? []), t])] } : d
    )
    useMinervaStore.setState({ documents: updated })
    setNewTag('')
    setShowTagInput(false)
  }

  return (
    <div className={`rounded-2xl border p-3.5 ${catMeta.bg} ${catMeta.border}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${catMeta.bg} border ${catMeta.border}`}>
          {catMeta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-navy leading-tight truncate">{doc.title}</p>
          <p className={`text-[9px] font-mono mt-0.5 ${catMeta.text}`}>{catMeta.label}</p>

          {/* Tags */}
          {(doc.tags?.length > 0 || showTagInput) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {doc.tags?.map(tag => (
                <button
                  key={tag}
                  onClick={() => onTagClick(tag)}
                  className="text-[9px] font-mono px-1.5 py-0.5 bg-white/60 text-muted rounded-full border border-border/60 active:scale-95"
                >
                  {tag}
                </button>
              ))}
              {showTagInput && (
                <input
                  type="text"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  placeholder="tag…"
                  autoFocus
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-blue/40 bg-white text-navy w-16 focus:outline-none"
                />
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {doc.driveUrl ? (
            <a
              href={doc.driveUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-xl bg-white/70 text-[10px] font-mono font-medium text-navy border border-border/50 active:scale-95 transition-all"
            >
              Open ↗
            </a>
          ) : (
            <span className="text-[9px] font-mono text-muted/50">No link</span>
          )}
          <button
            onClick={() => setShowTagInput(t => !t)}
            className="text-[9px] font-mono text-muted/60 active:text-blue transition-colors"
          >
            + tag
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export function Documents({ onNavigateToAsset }) {
  const documents = useMinervaStore(s => s.documents)

  const [query,       setQuery]       = useState('')
  const [activeCategory, setActiveCat] = useState(null) // null = All
  const [activeTags,  setActiveTags]  = useState([])

  // Enrich documents with smart category
  const enriched = useMemo(() =>
    documents.map(d => ({
      ...d,
      smartCat: smartCategory(d.title, d.category),
    })),
  [documents])

  // Category counts
  const catCounts = useMemo(() => {
    const counts = {}
    enriched.forEach(d => {
      counts[d.smartCat] = (counts[d.smartCat] ?? 0) + 1
    })
    return counts
  }, [enriched])

  // All unique tags
  const allTags = useMemo(() => {
    const set = new Set()
    enriched.forEach(d => d.tags?.forEach(t => set.add(t)))
    return [...set].sort()
  }, [enriched])

  // Toggle tag filter
  const toggleTag = (tag) => {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  // Filtered docs
  const filtered = useMemo(() => {
    return enriched.filter(d => {
      if (activeCategory && d.smartCat !== activeCategory) return false
      if (activeTags.length > 0 && !activeTags.every(t => d.tags?.includes(t))) return false
      if (query.trim().length >= 2) {
        const q = query.toLowerCase()
        const match = d.title.toLowerCase().includes(q)
          || d.tags?.some(t => t.toLowerCase().includes(q))
          || d.smartCat.includes(q)
        if (!match) return false
      }
      return true
    })
  }, [enriched, activeCategory, activeTags, query])

  // Group by recency
  const byRecency = useMemo(() => {
    const groups = {}
    filtered.forEach(d => {
      const g = getRecencyGroup(d.dateAdded)
      if (!groups[g]) groups[g] = []
      groups[g].push(d)
    })
    return groups
  }, [filtered])

  const recencyOrder = ['Today', 'This Week', 'This Month', 'Older']

  return (
    <div className="min-h-screen bg-alabaster pb-28">

      {/* Header */}
      <div className="bg-navy px-5 pt-12 pb-5">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Document Vault</p>
        <h1 className="text-xl font-bold text-white tracking-tight">Minerva Library</h1>
        <p className="text-xs font-mono mt-1" style={{ color: '#CBD5E1' }}>
          {documents.length} documents · {Object.keys(catCounts).length} categories
        </p>

        {/* Search */}
        <div className="relative mt-4">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm select-none pointer-events-none">⌕</span>
          <input
            type="search"
            placeholder="Search title, tag, category…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 font-mono"
          />
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs">✕</button>
          )}
        </div>
      </div>

      <div className="px-5 mt-5 space-y-5">

        {/* Category tiles */}
        <div>
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-3">Categories</p>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
            {/* All tile */}
            <button
              onClick={() => setActiveCat(null)}
              className={`flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-2xl border transition-all active:scale-95 ${
                activeCategory === null ? 'bg-navy text-white border-navy' : 'bg-surface text-muted border-border'
              }`}
            >
              <span className="text-2xl mb-1">📂</span>
              <span className="text-[9px] font-mono font-medium">All</span>
              <span className="text-[9px] font-mono mt-0.5 opacity-60">{documents.length}</span>
            </button>

            {Object.entries(CATEGORIES).map(([key, meta]) => {
              const count = catCounts[key] ?? 0
              if (count === 0) return null
              return (
                <CategoryTile
                  key={key}
                  catKey={key}
                  meta={meta}
                  count={count}
                  isActive={activeCategory === key}
                  onClick={() => setActiveCat(activeCategory === key ? null : key)}
                />
              )
            })}
          </div>
        </div>

        {/* Tag cloud */}
        {allTags.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Tags</p>
            <TagCloud allTags={allTags} activeTags={activeTags} onToggle={toggleTag} />
            {activeTags.length > 0 && (
              <button onClick={() => setActiveTags([])}
                className="text-[10px] font-mono text-rose mt-2 underline underline-offset-2">
                Clear tags
              </button>
            )}
          </div>
        )}

        {/* Results count */}
        {(query || activeCategory || activeTags.length > 0) && (
          <p className="text-[10px] font-mono text-muted">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            {activeCategory ? ` in ${CATEGORIES[activeCategory]?.label}` : ''}
            {activeTags.length > 0 ? ` tagged ${activeTags.join(', ')}` : ''}
          </p>
        )}

        {/* Empty state */}
        {documents.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm font-semibold text-slate">Vault is empty</p>
            <p className="text-xs text-muted font-mono mt-1">Tap 🗂 Vault to sync from Google Drive</p>
          </div>
        )}

        {filtered.length === 0 && documents.length > 0 && (
          <div className="text-center py-10">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm text-muted">No documents match</p>
            <button onClick={() => { setQuery(''); setActiveCat(null); setActiveTags([]) }}
              className="text-[10px] font-mono text-blue mt-2 underline">
              Clear filters
            </button>
          </div>
        )}

        {/* Documents grouped by recency */}
        {recencyOrder.map(group => {
          const docs = byRecency[group]
          if (!docs?.length) return null
          return (
            <div key={group}>
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2.5">
                {group} · {docs.length}
              </p>
              <div className="space-y-2">
                {docs.map(doc => (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    catMeta={CATEGORIES[doc.smartCat] ?? CATEGORIES.other}
                    onTagClick={toggleTag}
                    onAddTag={() => {}}
                  />
                ))}
              </div>
            </div>
          )
        })}

      </div>
    </div>
  )
}
