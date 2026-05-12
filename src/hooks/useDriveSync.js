// src/hooks/useDriveSync.js
// Google Drive sync — SAVE ONLY on mount, never auto-load
// Auto-load disabled to prevent overwriting locally imported data

import { useEffect, useCallback, useRef } from 'react'
import { useMinervaStore }                from '../state/store.js'

const CLIENT_ID   = '518898336060-0o47asbhrmrdcegdou3s2k70bq1klvtn.apps.googleusercontent.com'
const SCOPE       = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file'
const FILE_NAME   = 'minerva_data.json'
const DEBOUNCE_MS = 5000
const REDIRECT_URI = window.location.origin + window.location.pathname

function getStoredToken() {
  try {
    const t = localStorage.getItem('minerva_drive_token')
    if (!t) return null
    const parsed = JSON.parse(t)
    if (Date.now() > parsed.expires_at) {
      localStorage.removeItem('minerva_drive_token')
      return null
    }
    return parsed.access_token
  } catch { return null }
}

function storeToken(accessToken, expiresIn) {
  localStorage.setItem('minerva_drive_token', JSON.stringify({
    access_token: accessToken,
    expires_at:   Date.now() + (expiresIn * 1000) - 60000,
  }))
}

function clearToken() {
  localStorage.removeItem('minerva_drive_token')
}

function parseTokenFromHash() {
  const hash = window.location.hash.substring(1)
  if (!hash) return null
  const params = new URLSearchParams(hash)
  const token  = params.get('access_token')
  const expiry = params.get('expires_in')
  if (!token) return null
  storeToken(token, parseInt(expiry) || 3600)
  window.history.replaceState({}, document.title, window.location.pathname)
  return token
}

async function driveGet(path, token) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (res.status === 401) { clearToken(); return null }
  if (!res.ok) throw new Error(`Drive API ${res.status}`)
  return res.json()
}

async function findFile(token) {
  const q   = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`)
  const data = await driveGet(`files?q=${q}&fields=files(id,modifiedTime)`, token)
  return data?.files?.[0] ?? null
}

async function writeFile(fileId, data, token) {
  const body = JSON.stringify({ ...data, syncedAt: new Date().toISOString() })
  if (fileId) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    })
  } else {
    const boundary = 'minerva_boundary'
    const meta = JSON.stringify({ name: FILE_NAME, mimeType: 'application/json' })
    const multipart = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body:    multipart,
    })
    return (await res.json()).id
  }
}

export function useDriveSync() {
  const setSyncStatus = useMinervaStore(s => s.setSyncStatus)
  const setLastSynced = useMinervaStore(s => s.setLastSynced)
  const syncStatus    = useMinervaStore(s => s.syncStatus)

  const fileIdRef   = useRef(null)
  const tokenRef    = useRef(getStoredToken())
  const debounceRef = useRef(null)

  // Sign in via OAuth redirect
  const signIn = useCallback(() => {
    const params = new URLSearchParams({
      client_id:     CLIENT_ID,
      redirect_uri:  REDIRECT_URI,
      response_type: 'token',
      scope:         SCOPE,
      prompt:        'select_account',
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }, [])

  const signOut = useCallback(() => {
    clearToken()
    tokenRef.current  = null
    fileIdRef.current = null
    setSyncStatus?.('idle')
  }, [setSyncStatus])

  // Save to Drive (debounced) — WRITE ONLY
  const scheduleSave = useCallback(() => {
    if (!tokenRef.current) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        setSyncStatus?.('syncing')
        const state = useMinervaStore.getState()
        // Find file ID if we don't have it yet
        if (!fileIdRef.current) {
          const file = await findFile(tokenRef.current)
          if (file) fileIdRef.current = file.id
        }
        const newId = await writeFile(fileIdRef.current, {
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
          plannedSpends:     state.plannedSpends,
        }, tokenRef.current)
        if (newId) fileIdRef.current = newId
        setLastSynced?.(new Date().toISOString())
        setSyncStatus?.('idle')
        console.log('[Minerva] Saved to Drive')
      } catch (e) {
        console.error('[Minerva] Save failed:', e)
        setSyncStatus?.('error')
      }
    }, DEBOUNCE_MS)
  }, [setSyncStatus, setLastSynced])

  // On mount: grab token from OAuth redirect if present — NO auto-load
  useEffect(() => {
    const redirectToken = parseTokenFromHash()
    if (redirectToken) {
      tokenRef.current = redirectToken
      console.log('[Minerva] Drive connected')
    }
    // Do NOT load from Drive — localStorage is source of truth
  }, [])

  // Subscribe to store — save on financial data changes only
  useEffect(() => {
    const unsub = useMinervaStore.subscribe(
      (state) => ({
        transactions: state.transactions,
        accounts:     state.accounts,
        documents:    state.documents,
        budgets:      state.budgets,
      }),
      () => scheduleSave()
    )
    return () => { unsub(); clearTimeout(debounceRef.current) }
  }, [scheduleSave])

  return {
    syncStatus,
    signIn,
    signOut,
    isSignedIn:  !!tokenRef.current,
    getToken:    () => tokenRef.current,
  }
}
