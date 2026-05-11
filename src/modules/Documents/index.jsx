import { useState, useMemo } from 'react'
import { useMinervaStore }   from '../../state/store.js'

// ─── Pinned document IDs persisted in store ───────────────────────────────────
// Max 6 pins. Stored in documents array as doc.pinned = true

// ─── Recency grouping ─────────────────────────────────────────────────────────
function getRecencyGroup(dateStr) {
  if (!dateStr) return 'Older'
  const diff = (Date.now() - new Date(dateStr)) / 86400000
  if (diff < 1)  return 'Today'
  if (diff < 7)  return 'This Week'
  if (diff < 30) return 'This Month'
  return 'Older'
}

// ─── Pinned Row ───────────────────────────────────────────────────────────────
function PinnedRow({ docs, onUnpin }) {
  if (!docs.length) return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
      <div className="flex-shrink-0 w-28 h-20 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1">
        <span className="text-xl">📌</span>
        <p className="text-[9px] font-mono text-muted text-center leading-tight px-1">Pin docs for quick access</p>
      </div>
    </div>
  )

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
      {docs.map(doc => (
        <div key={doc.id} className="flex-shrink-0 w-28">
          <div className="h-20 rounded-2xl bg-navy flex flex-col items-start justify-between p-3 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
            <button
              onClick={() => onUnpin(doc.id)}
              className="absolute top-1.5 right-1.5 text-white/30 text-[10px] hover:text-white/60 z-10"
            >
              ✕
            </button>
            <span className="text-lg leading-none z-10">
              {getDocIcon(doc)}
            </span>
            <div className="z-10 w-full">
              <p className="text-[9px] font-mono text-white font-medium leading-tight truncate">
                {doc.title.replace(/\.[^.]+$/, '')}
              </p>
            </div>
          </div>
          {doc.driveUrl ? (
            <a href={doc.driveUrl} target="_blank" rel="noreferrer"
              className="block text-center text-[9px] font-mono text-blue mt-1">
              Open ↗
            </a>
          ) : null}
        </div>
      ))}

      {/* Add pin slot if under 6 */}
      {docs.length < 6 && (
        <div className="flex-shrink-0 w-28 h-20 rounded-2xl border-2 border-dashed border-border/60 flex items-center justify-center">
          <p className="text-[9px] font-mono text-muted/60 text-center px-2">tap 📌 on any doc</p>
        </div>
      )}
    </div>
  )
}

// ─── Get icon from tags ───────────────────────────────────────────────────────
function getDocIcon(doc) {
  const tags = (doc.tags ?? []).map(t => t.toLowerCase())
  if (tags.some(t => ['passport','eid','visa','identity','aadhaar','pan','birth'].some(k => t.includes(k)))) return '🪪'
  if (tags.some(t => ['banking','adcb','hsbc','wio','chase','amex','hdfc','sbi','dbs'].some(k => t.includes(k)))) return '🏦'
  if (tags.some(t => ['investment','ibkr','fcnr','dews','portfolio','reit'].some(k => t.includes(k)))) return '📊'
  if (tags.some(t => ['property','villa','mortgage','warehouse','sfh','mumbai','pune'].some(k => t.includes(k)))) return '🏠'
  if (tags.some(t => ['corporate','llc','kyck','ikarma','infinity','vista'].some(k => t.includes(k)))) return '🏢'
  if (tags.some(t => ['legal','sblc','lien','agreement','contract'].some(k => t.includes(k)))) return '⚖️'
  return '📄'
}

// ─── Document Card ────────────────────────────────────────────────────────────
function DocCard({ doc, isPinned, onPin, onUnpin, onTagClick, activeTags }) {
  const [showTagInput, setShowTagInput] = useState(false)
  const [newTag, setNewTag]             = useState('')
  const documents                       = useMinervaStore(s => s.documents)

  const handleAddTag = () => {
    const t = newTag.trim()
    if (!t) return
    const updated = documents.map(d =>
      d.id === doc.id ? { ...d, tags: [...new Set([...(d.tags ?? []), t])] } : d
    )
    useMinervaStore.setState({ documents: updated })
    setNewTag('')
    setShowTagInput(false)
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-3.5">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-alabaster border border-border flex items-center justify-center flex-shrink-0 text-lg">
          {getDocIcon(doc)}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-navy leading-tight">{doc.title.replace(/\.[^.]+$/, '')}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-2">
            {doc.tags?.map(tag => {
              const active = activeTags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => onTagClick(tag)}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border transition-all active:scale-95 ${
                    active
                      ? 'bg-navy text-white border-navy'
                      : 'bg-alabaster text-muted border-border'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
            {showTagInput ? (
              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') setShowTagInput(false) }}
                placeholder="tag…"
                autoFocus
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-blue/40 bg-white text-navy w-16 focus:outline-none"
              />
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-dashed border-border text-muted/60 active:scale-95"
              >
                + tag
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {doc.driveUrl ? (
            <a
              href={doc.driveUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-xl bg-blue-lt text-blue text-[10px] font-mono font-medium active:scale-95 transition-all"
            >
              Open ↗
            </a>
          ) : (
            <span className="text-[9px] font-mono text-muted/40">No link</span>
          )}
          <button
            onClick={() => isPinned ? onUnpin(doc.id) : onPin(doc.id)}
            className={`text-[11px] transition-all active:scale-95 ${isPinned ? 'opacity-100' : 'opacity-30 hover:opacity-70'}`}
            title={isPinned ? 'Unpin' : 'Pin to top'}
          >
            📌
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export function Documents({ onNavigateToAsset }) {
  const documents = useMinervaStore(s => s.documents)

  const [query,      setQuery]      = useState('')
  const [activeTags, setActiveTags] = useState([])

  // Pin/unpin
  const togglePin = (id, pin) => {
    const updated = documents.map(d =>
      d.id === id ? { ...d, pinned: pin } : d
    )
    useMinervaStore.setState({ documents: updated })
  }

  const pinnedDocs = useMemo(() => documents.filter(d => d.pinned), [documents])

  // All unique tags sorted by frequency
  const allTags = useMemo(() => {
    const freq = {}
    documents.forEach(d => d.tags?.forEach(t => { freq[t] = (freq[t] ?? 0) + 1 }))
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
  }, [documents])

  // Toggle tag filter
  const toggleTag = (tag) => {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  // Filtered docs
  const filtered = useMemo(() => {
    return documents.filter(d => {
      if (activeTags.length > 0 && !activeTags.every(t => d.tags?.includes(t))) return false
      if (query.trim().length >= 2) {
        const q = query.toLowerCase()
        return d.title.toLowerCase().includes(q) || d.tags?.some(t => t.toLowerCase().includes(q))
      }
      return true
    })
  }, [documents, activeTags, query])

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

  const RECENCY_ORDER = ['Today', 'This Week', 'This Month', 'Older']

  return (
    <div className="min-h-screen bg-alabaster pb-28">

      {/* Header */}
      <div className="bg-navy px-5 pt-12 pb-5">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Document Vault</p>
        <h1 className="text-xl font-bold text-white tracking-tight">Minerva Library</h1>
        <p className="text-xs font-mono mt-1" style={{ color: '#CBD5E1' }}>
          {documents.length} documents · {allTags.length} tags · {pinnedDocs.length} pinned
        </p>

        {/* Search */}
        <div className="relative mt-4">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm select-none pointer-events-none">⌕</span>
          <input
            type="search"
            placeholder="Search title or tag…"
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

      <div className="px-5 mt-5 space-y-6">

        {/* Pinned */}
        <div>
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-3">
            📌 Pinned · Quick Access
          </p>
          <PinnedRow
            docs={pinnedDocs}
            onUnpin={id => togglePin(id, false)}
          />
        </div>

        {/* Tag cloud — sorted by frequency */}
        {allTags.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Tags</p>
              {activeTags.length > 0 && (
                <button onClick={() => setActiveTags([])}
                  className="text-[10px] font-mono text-rose underline underline-offset-2">
                  Clear
                </button>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {allTags.map(tag => {
                const active = activeTags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium border transition-all active:scale-95 ${
                      active ? 'bg-navy text-white border-navy' : 'bg-surface text-muted border-border'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Result count when filtering */}
        {(query || activeTags.length > 0) && (
          <p className="text-[10px] font-mono text-muted -mt-2">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            {activeTags.length > 0 ? ` · ${activeTags.join(' + ')}` : ''}
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
            <button onClick={() => { setQuery(''); setActiveTags([]) }}
              className="text-[10px] font-mono text-blue mt-2 underline">
              Clear filters
            </button>
          </div>
        )}

        {/* Documents grouped by recency */}
        {RECENCY_ORDER.map(group => {
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
                    isPinned={!!doc.pinned}
                    onPin={id => togglePin(id, true)}
                    onUnpin={id => togglePin(id, false)}
                    onTagClick={toggleTag}
                    activeTags={activeTags}
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
