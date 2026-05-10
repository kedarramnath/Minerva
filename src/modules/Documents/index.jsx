import { useState, useRef, useEffect } from 'react'
import { useMinervaStore }              from '../../state/store.js'

const DOC_CATEGORY_ICON = {
  statement:'📄', legal:'📋', identity:'🪪', property:'🏠',
  investment:'📈', insurance:'🛡️', other:'📦',
}

// ─── Global Search ────────────────────────────────────────────────────────────

function GlobalSearch({ onNavigateToAsset }) {
  const selectGlobalSearch   = useMinervaStore(s => s.selectGlobalSearch)
  const [query, setQuery]    = useState('')
  const [results, setResults] = useState([])

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const t = setTimeout(() => setResults(selectGlobalSearch(query)), 120)
    return () => clearTimeout(t)
  }, [query])

  const handleTap = (r) => {
    if (r.type === 'document' && r.driveUrl) window.open(r.driveUrl, '_blank')
    else if (r.type === 'asset' || r.type === 'liability') onNavigateToAsset?.(r.id, r.type)
    setQuery(''); setResults([])
  }

  const typeStyle = {
    document:  'bg-blue-lt text-blue',
    asset:     'bg-sage-lt text-sage',
    liability: 'bg-rose-lt text-rose',
  }

  return (
    <div>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm select-none pointer-events-none">⌕</span>
        <input
          type="search"
          placeholder="Search documents, assets, tags…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-9 py-3 rounded-2xl border border-border bg-surface text-sm text-slate focus:outline-none focus:border-blue transition-colors font-mono placeholder:text-muted/60"
        />
        {query.length > 0 && (
          <button onClick={() => { setQuery(''); setResults([]) }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted text-xs">✕</button>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-2 bg-surface rounded-2xl border border-border overflow-hidden shadow-card-md">
          {results.map((r, i) => (
            <button key={r.id} onClick={() => handleTap(r)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-alabaster transition-colors ${i < results.length - 1 ? 'border-b border-border/60' : ''}`}
            >
              <span className="text-base flex-shrink-0">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate truncate">{r.title}</p>
                {r.sub && <p className="text-[10px] font-mono text-muted mt-0.5 truncate">{r.sub}</p>}
              </div>
              <span className={`flex-shrink-0 text-[9px] font-mono px-2 py-0.5 rounded-full ${typeStyle[r.type] ?? ''}`}>
                {r.type}
              </span>
            </button>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && results.length === 0 && (
        <div className="mt-2 bg-surface rounded-2xl border border-border px-4 py-5 text-center">
          <p className="text-xs text-muted">No matches for "{query}"</p>
          <p className="text-[10px] font-mono text-muted/60 mt-1">Try document name, asset name, or tag</p>
        </div>
      )}
    </div>
  )
}

// ─── Document List ────────────────────────────────────────────────────────────

function DocumentList() {
  const documents = useMinervaStore(s => s.documents)
  const byCategory = documents.reduce((acc, d) => {
    if (!acc[d.category]) acc[d.category] = []
    acc[d.category].push(d); return acc
  }, {})

  if (!documents.length) return (
    <div className="text-center py-16">
      <p className="text-3xl mb-3">📭</p>
      <p className="text-sm font-medium text-slate">No documents yet</p>
      <p className="text-xs text-muted font-mono mt-1">Tap + to add your first document.</p>
    </div>
  )

  return (
    <div className="space-y-5">
      {Object.entries(byCategory).map(([cat, docs]) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-sm">{DOC_CATEGORY_ICON[cat] ?? '📦'}</span>
            <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </span>
            <span className="text-[9px] font-mono text-muted/60">({docs.length})</span>
          </div>
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            {docs.map((doc, i) => (
              <div key={doc.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < docs.length - 1 ? 'border-b border-border/60' : ''}`}
              >
                <span className="text-base flex-shrink-0">{DOC_CATEGORY_ICON[doc.category] ?? '📦'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate truncate">{doc.title}</p>
                  {doc.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {doc.tags.map(tag => (
                        <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 bg-alabaster text-muted rounded-full border border-border">{tag}</span>
                      ))}
                    </div>
                  )}
                  {(doc.linked_doc_uids ?? []).length > 0 && (
                    <p className="text-[9px] font-mono text-muted/60 mt-1">
                      Linked to {(doc.linked_doc_uids ?? []).length} asset{(doc.linked_doc_uids ?? []).length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                {doc.driveUrl ? (
                  <a href={doc.driveUrl} target="_blank" rel="noreferrer"
                    className="flex-shrink-0 px-2.5 py-1.5 rounded-xl bg-blue-lt text-blue text-[10px] font-mono active:scale-95 transition-all">
                    Open ↗
                  </a>
                ) : (
                  <span className="flex-shrink-0 text-[9px] font-mono text-muted/40 px-2 py-1 bg-alabaster rounded-lg border border-border">No URL</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export function Documents({ onNavigateToAsset }) {
  const documents = useMinervaStore(s => s.documents)
  return (
    <div className="min-h-screen bg-alabaster pb-28">
      <div className="bg-navy px-5 pt-12 pb-5">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Document Suite</p>
        <h1 className="text-xl font-bold text-white tracking-tight">Unified Vault</h1>
        <p className="text-xs text-white/40 font-mono mt-1">
          {documents.length} document{documents.length !== 1 ? 's' : ''} · fuzzy search across all
        </p>
      </div>
      <div className="px-5 space-y-5 mt-5">
        <GlobalSearch onNavigateToAsset={onNavigateToAsset} />
        <DocumentList />
      </div>
    </div>
  )
}
