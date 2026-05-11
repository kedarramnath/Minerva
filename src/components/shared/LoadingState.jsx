// src/components/shared/LoadingState.jsx
// Processing overlay + skeleton loaders
// Used when: loading from Drive, importing statement data, initial app load

import { useEffect, useState } from 'react'
import { useMinervaStore }     from '../../state/store.js'

// ─── Skeleton line (shimmering placeholder) ───────────────────────────────────
function SkeletonLine({ width = 'w-full', height = 'h-3' }) {
  return (
    <div className={`${width} ${height} bg-gradient-to-r from-border via-alabaster to-border rounded-full animate-pulse`} />
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonLine width="w-1/3" height="h-2.5" />
        <SkeletonLine width="w-1/4" height="h-2.5" />
      </div>
      <SkeletonLine width="w-full" height="h-2" />
      <SkeletonLine width="w-3/4" height="h-2" />
      <SkeletonLine width="w-1/2" height="h-2" />
    </div>
  )
}

// ─── Full screen processing overlay ───────────────────────────────────────────
// Shows when syncing to/from Drive or loading statements
export function ProcessingOverlay({ message = 'Analyzing Statements…', show }) {
  const [dots, setDots] = useState('.')

  useEffect(() => {
    if (!show) return
    const t = setInterval(() => {
      setDots(d => d.length >= 3 ? '.' : d + '.')
    }, 500)
    return () => clearInterval(t)
  }, [show])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[200] bg-navy/80 backdrop-blur-sm flex flex-col items-center justify-center">
      {/* KAY mark spinner */}
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
          <img
            src="/Minerva/icons/logo-header.png"
            alt="Minerva"
            className="w-10 h-10 animate-pulse"
          />
        </div>
        {/* Spinning ring */}
        <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-[#CBD5E1] animate-spin" />
      </div>

      <p className="text-white font-semibold text-base tracking-tight">
        {message}{dots}
      </p>
      <p className="text-white/40 font-mono text-[11px] mt-2 uppercase tracking-widest">
        Minerva Financial
      </p>
    </div>
  )
}

// ─── Sync status bar ──────────────────────────────────────────────────────────
// Lightweight inline indicator — shows at top of screen during Drive sync
export function SyncStatusBar() {
  const syncStatus   = useMinervaStore(s => s.syncStatus)
  const lastSyncedAt = useMinervaStore(s => s.lastSyncedAt)

  if (syncStatus === 'idle') return null

  const messages = {
    syncing: { text: 'Syncing to Drive…', color: 'bg-blue',  dot: 'bg-blue-lt' },
    error:   { text: 'Sync failed — working offline', color: 'bg-rose',  dot: 'bg-rose-lt' },
    offline: { text: 'Offline — changes queued', color: 'bg-amber', dot: 'bg-amber-lt' },
  }

  const meta = messages[syncStatus]
  if (!meta) return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-[150] ${meta.color} py-1.5 px-4 flex items-center justify-center gap-2`}>
      <div className={`w-1.5 h-1.5 rounded-full ${meta.dot} animate-pulse`} />
      <p className="text-white text-[11px] font-mono">{meta.text}</p>
    </div>
  )
}

// ─── Dashboard skeleton ───────────────────────────────────────────────────────
// Shown while first load is in progress
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-alabaster pb-28 animate-pulse">
      {/* Header skeleton */}
      <div className="bg-navy px-5 pt-14 pb-5 space-y-4">
        <SkeletonLine width="w-1/3" height="h-2" />
        <SkeletonLine width="w-1/2" height="h-8" />
        <SkeletonLine width="w-1/4" height="h-3" />
        <SkeletonLine width="w-full" height="h-8" />
      </div>
      {/* Body skeleton */}
      <div className="px-5 mt-5 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
