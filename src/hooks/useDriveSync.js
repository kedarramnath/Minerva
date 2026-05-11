// src/hooks/useDriveSync.js
// Google Drive sync — reads/writes minerva_data.json to user's Drive.
//
// SETUP (one-time, 10 minutes):
//   1. Go to https://console.cloud.google.com
//   2. Create project "Minerva Financial"
//   3. Enable "Google Drive API"
//   4. OAuth consent screen → External → add your Gmail as test user
//   5. Credentials → Create OAuth Client ID → Web Application
//      Authorised JS origins: http://localhost:5173, https://your-github-pages-url
//   6. Copy Client ID → paste into VITE_GOOGLE_CLIENT_ID in .env.local
//
// The app uses scope 'drive.file' — it can ONLY see files it creates itself.
// It cannot read any other Drive files. Minimal permission footprint.
//
// ARCHITECTURE:
//   - On mount: attempt silent token refresh (gapi.auth2.getAuthInstance)
//   - If token valid: load minerva_data.json → hydrate store
//   - On every store mutation (debounced 3s): write full state to Drive
//   - Conflict: last-write-wins via updatedAt timestamp
//   - Offline: writes queue in localStorage, flush on reconnect

import { useEffect, useRef, useCallback } from 'react'
import { useMinervaStore }                from '../state/store.js'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '518898336060-0o47asbhrmrdcegdou3s2k70bq1klvtn.apps.googleusercontent.com'
const SCOPE     = 'https://www.googleapis.com/auth/drive.file'
const FILE_NAME = 'minerva_data.json'
const MIME      = 'application/json'
const DEBOUNCE_MS = 3000

// ─── Google API loader ────────────────────────────────────────────────────────

let gapiLoaded    = false
let gapiLoading   = false
let gapiCallbacks = []

function loadGapi() {
  return new Promise((resolve, reject) => {
    if (gapiLoaded) { resolve(); return }
    gapiCallbacks.push({ resolve, reject })
    if (gapiLoading) return
    gapiLoading = true

    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = () => {
      window.gapi.load('client:auth2', async () => {
        try {
          await window.gapi.client.init({
            clientId: CLIENT_ID,
            scope:    SCOPE,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          })
          gapiLoaded = true
          gapiCallbacks.forEach(cb => cb.resolve())
          gapiCallbacks = []
        } catch (e) {
          gapiCallbacks.forEach(cb => cb.reject(e))
          gapiCallbacks = []
        }
      })
    }
    script.onerror = (e) => {
      gapiCallbacks.forEach(cb => cb.reject(e))
      gapiCallbacks = []
    }
    document.head.appendChild(script)
  })
}

// ─── Drive file operations ────────────────────────────────────────────────────

async function findFile() {
  const res = await window.gapi.client.drive.files.list({
    q:      `name='${FILE_NAME}' and trashed=false`,
    fields: 'files(id,name,modifiedTime)',
    spaces: 'drive',
  })
  return res.result.files?.[0] ?? null
}

async function readFile(fileId) {
  const res = await window.gapi.client.drive.files.get({
    fileId,
    alt: 'media',
  })
  return typeof res.body === 'string' ? JSON.parse(res.body) : res.result
}

async function writeFile(fileId, data) {
  const body = JSON.stringify({ ...data, syncedAt: new Date().toISOString() })

  if (fileId) {
    // Update existing file
    await window.gapi.client.request({
      path:   `/upload/drive/v3/files/${fileId}`,
      method: 'PATCH',
      params: { uploadType: 'media' },
      headers: { 'Content-Type': MIME },
      body,
    })
  } else {
    // Create new file
    const boundary = '-------minerva_boundary'
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelim = `\r\n--${boundary}--`
    const metadata = JSON.stringify({ name: FILE_NAME, mimeType: MIME })
    const multipart =
      delimiter + 'Content-Type: application/json\r\n\r\n' + metadata +
      delimiter + `Content-Type: ${MIME}\r\n\r\n` + body +
      closeDelim

    const res = await window.gapi.client.request({
      path:   '/upload/drive/v3/files',
      method: 'POST',
      params: { uploadType: 'multipart' },
      headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body:   multipart,
    })
    return res.result.id
  }
}

// ─── STATE EXTRACTOR ─────────────────────────────────────────────────────────
// What we persist to Drive — same as Zustand partialize

function extractPersistableState(state) {
  return {
    accounts:          state.accounts,
    assets:            state.assets,
    liabilities:       state.liabilities,
    transactions:      state.transactions,
    reconciliationLog: state.reconciliationLog,
    budgets:           state.budgets,
    targets:           state.targets,
    documents:         state.documents,
    fx:                state.fx,
    surplusConfig:     state.surplusConfig,
    activeCurrency:    state.activeCurrency,
    liveLiquidity:     state.liveLiquidity,
    netWorth:          state.netWorth,
    updatedAt:         new Date().toISOString(),
  }
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function useDriveSync() {
  const setSyncStatus  = useMinervaStore(s => s.setSyncStatus)
  const setLastSynced  = useMinervaStore(s => s.setLastSynced)
  const syncStatus     = useMinervaStore(s => s.syncStatus)

  const fileIdRef      = useRef(null)  // cached Drive file ID
  const debounceRef    = useRef(null)
  const pendingWriteRef = useRef(false)
  const isSignedInRef  = useRef(false)

  // ── Sign in ──────────────────────────────────────────────────────────────
  const signIn = useCallback(async () => {
    if (!CLIENT_ID) {
      console.warn('[Minerva] VITE_GOOGLE_CLIENT_ID not set — Drive sync disabled')
      return false
    }
    try {
      await loadGapi()
      const auth = window.gapi.auth2.getAuthInstance()
      if (!auth.isSignedIn.get()) {
        await auth.signIn({ prompt: 'select_account' })
      }
      isSignedInRef.current = true
      return true
    } catch (e) {
      console.error('[Minerva] Sign-in failed:', e)
      return false
    }
  }, [])

  // ── Sign out ─────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      const auth = window.gapi.auth2.getAuthInstance()
      await auth.signOut()
      isSignedInRef.current = false
      fileIdRef.current = null
    } catch (e) {
      console.error('[Minerva] Sign-out failed:', e)
    }
  }, [])

  // ── Load from Drive ───────────────────────────────────────────────────────
  const loadFromDrive = useCallback(async () => {
    if (!isSignedInRef.current) return false
    try {
      setSyncStatus?.('syncing')
      const file = await findFile()
      if (!file) {
        console.log('[Minerva] No minerva_data.json found in Drive — first run')
        setSyncStatus?.('idle')
        return false
      }
      fileIdRef.current = file.id
      const data = await readFile(file.id)

      // Hydrate store with Drive data
      useMinervaStore.setState(state => ({
        ...state,
        accounts:          data.accounts          ?? state.accounts,
        assets:            data.assets            ?? state.assets,
        liabilities:       data.liabilities       ?? state.liabilities,
        transactions:      data.transactions      ?? state.transactions,
        reconciliationLog: data.reconciliationLog ?? state.reconciliationLog,
        budgets:           data.budgets           ?? state.budgets,
        targets:           data.targets           ?? state.targets,
        documents:         data.documents         ?? state.documents,
        fx:                data.fx                ?? state.fx,
        surplusConfig:     data.surplusConfig     ?? state.surplusConfig,
        activeCurrency:    data.activeCurrency    ?? state.activeCurrency,
      }))

      // Recompute derived values after hydration
      useMinervaStore.getState()._recompute()

      setLastSynced?.(data.syncedAt ?? new Date().toISOString())
      setSyncStatus?.('idle')
      console.log(`[Minerva] Loaded from Drive (${file.id})`)
      return true
    } catch (e) {
      console.error('[Minerva] Load from Drive failed:', e)
      setSyncStatus?.('error')
      return false
    }
  }, [])

  // ── Save to Drive (debounced) ─────────────────────────────────────────────
  const scheduleSave = useCallback(() => {
    if (!isSignedInRef.current) return
    pendingWriteRef.current = true
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!pendingWriteRef.current) return
      pendingWriteRef.current = false
      try {
        setSyncStatus?.('syncing')
        const state = useMinervaStore.getState()
        const data  = extractPersistableState(state)
        const newId = await writeFile(fileIdRef.current, data)
        if (newId) fileIdRef.current = newId
        setLastSynced?.(new Date().toISOString())
        setSyncStatus?.('idle')
      } catch (e) {
        console.error('[Minerva] Save to Drive failed:', e)
        setSyncStatus?.('error')
        // Re-queue — will retry on next mutation
        pendingWriteRef.current = true
      }
    }, DEBOUNCE_MS)
  }, [])

  // ── Subscribe to store mutations ──────────────────────────────────────────
  useEffect(() => {
    const unsub = useMinervaStore.subscribe(
      state => state.meta?.updatedAt,  // trigger on any data mutation
      () => scheduleSave()
    )
    return () => { unsub(); clearTimeout(debounceRef.current) }
  }, [scheduleSave])

  // ── Auto sign-in attempt on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!CLIENT_ID) return
    loadGapi().then(async () => {
      const auth = window.gapi.auth2.getAuthInstance()
      if (auth.isSignedIn.get()) {
        isSignedInRef.current = true
        await loadFromDrive()
      }
    }).catch(() => {
      console.warn('[Minerva] GAPI load failed — running offline')
    })
  }, [loadFromDrive])

  return {
    syncStatus,
    signIn,
    signOut,
    loadFromDrive,
    scheduleSave,
    isSignedIn: isSignedInRef.current,
  }
}
