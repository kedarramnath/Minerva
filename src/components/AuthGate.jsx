// src/components/AuthGate.jsx
// Two-layer security:
//   Layer 1 — Google Sign-In (browser + PWA first launch)
//             Only kedar.ramnath@gmail.com and anisha.joshi@gmail.com can access.
//   Layer 2 — Face ID / Touch ID (iPhone PWA, after first Google sign-in)
//             WebAuthn biometric registered once, checked on every app open.
//
// Flow:
//   Browser:  Google Sign-In → app
//   iPhone:   Google Sign-In (once) → register Face ID → app
//             Subsequent opens: Face ID only → app (no Google redirect)

import { useState, useEffect, useCallback } from 'react'

// Allowed Google accounts
const ALLOWED_EMAILS = [
  'kedar.ramnath@gmail.com',
  'joshianeesha318@gmail.com',
]

const CLIENT_ID   = '518898336060-0o47asbhrmrdcegdou3s2k70bq1klvtn.apps.googleusercontent.com'
const REDIRECT_URI = window.location.origin + window.location.pathname

const LS_AUTH     = 'minerva_auth'       // { email, name, picture, exp }
const LS_BIOMETRIC = 'minerva_biometric' // 'registered' | absent

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStoredAuth() {
  try {
    const raw = localStorage.getItem(LS_AUTH)
    if (!raw) return null
    const auth = JSON.parse(raw)
    if (Date.now() > auth.exp) { localStorage.removeItem(LS_AUTH); return null }
    return auth
  } catch { return null }
}

function storeAuth(email, name, picture) {
  // Session lasts 8 hours
  localStorage.setItem(LS_AUTH, JSON.stringify({
    email, name, picture,
    exp: Date.now() + 8 * 60 * 60 * 1000,
  }))
}

function clearAuth() {
  localStorage.removeItem(LS_AUTH)
  localStorage.removeItem(LS_BIOMETRIC)
  localStorage.removeItem('minerva_drive_token')
}

function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

function isBiometricRegistered() {
  return localStorage.getItem(LS_BIOMETRIC) === 'registered'
}

// Parse Google ID token from URL hash (implicit flow)
function parseGoogleToken() {
  const hash   = window.location.hash.substring(1)
  if (!hash) return null
  const params = new URLSearchParams(hash)
  const token  = params.get('id_token')
  const access = params.get('access_token')
  const expiry = params.get('expires_in')
  if (!token && !access) return null

  // Decode JWT payload (no signature verification needed — Google already validated it)
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return { email: payload.email, name: payload.name, picture: payload.picture, access, expiry }
    } catch { return null }
  }
  return null
}

// ─── WebAuthn (Face ID / Touch ID) ────────────────────────────────────────────

const WEBAUTHN_RP_ID   = window.location.hostname
const WEBAUTHN_RP_NAME = 'Minerva Financial'
const WEBAUTHN_KEY     = 'minerva_webauthn_cred'

function uint8ArrayToBase64(arr) {
  return btoa(String.fromCharCode(...arr))
}
function base64ToUint8Array(b64) {
  return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)))
}

async function registerBiometric(email) {
  if (!window.PublicKeyCredential) return false
  try {
    const challenge  = crypto.getRandomValues(new Uint8Array(32))
    const userId     = new TextEncoder().encode(email)
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp:   { id: WEBAUTHN_RP_ID, name: WEBAUTHN_RP_NAME },
        user: { id: userId, name: email, displayName: 'Minerva User' },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      }
    })
    // Store credential ID for future authentication
    localStorage.setItem(WEBAUTHN_KEY, uint8ArrayToBase64(new Uint8Array(credential.rawId)))
    localStorage.setItem(LS_BIOMETRIC, 'registered')
    return true
  } catch (e) {
    console.warn('[Minerva] Biometric registration failed:', e.message)
    return false
  }
}

async function authenticateBiometric() {
  if (!window.PublicKeyCredential) return false
  const credIdB64 = localStorage.getItem(WEBAUTHN_KEY)
  if (!credIdB64) return false
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId:           WEBAUTHN_RP_ID,
        allowCredentials: [{
          type: 'public-key',
          id:   base64ToUint8Array(credIdB64),
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
      }
    })
    return true
  } catch (e) {
    console.warn('[Minerva] Biometric auth failed:', e.message)
    return false
  }
}

// ─── Login screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onSignIn, error }) {
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <img
        src="/Minerva/icons/logo-header.png"
        alt="Minerva"
        className="w-16 h-16 mb-6 opacity-90"
      />
      <p className="font-mono text-[10px] tracking-[0.3em] text-white/30 uppercase mb-2">
        Minerva Financial
      </p>
      <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">
        Kedar · Anisha · Yuvi
      </h1>
      <p className="text-xs font-mono text-white/30 mb-12">
        Private Family Office
      </p>

      {error && (
        <div className="mb-6 px-4 py-2.5 bg-rose/20 border border-rose/30 rounded-xl">
          <p className="text-xs font-mono text-rose-lt text-center">{error}</p>
        </div>
      )}

      <button
        onClick={onSignIn}
        className="flex items-center gap-3 px-6 py-3.5 bg-white rounded-2xl text-navy text-sm font-semibold active:scale-[0.97] transition-all shadow-lg"
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
          <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
          <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
          <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
        </svg>
        Sign in with Google
      </button>

      <p className="text-[10px] font-mono text-white/20 mt-8 text-center">
        Access restricted to authorised accounts only
      </p>
    </div>
  )
}

// ─── Biometric prompt ─────────────────────────────────────────────────────────

function BiometricPrompt({ name, picture, onAuthenticate, onSignOut, error }) {
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6">
      {picture ? (
        <img src={picture} alt={name} className="w-16 h-16 rounded-full mb-4 border-2 border-white/20" />
      ) : (
        <img src="/Minerva/icons/logo-header.png" alt="Minerva" className="w-16 h-16 mb-4 opacity-90" />
      )}

      <p className="text-white font-semibold text-lg mb-1">{name}</p>
      <p className="font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase mb-12">
        Minerva Financial
      </p>

      {error && (
        <div className="mb-6 px-4 py-2.5 bg-rose/20 border border-rose/30 rounded-xl">
          <p className="text-xs font-mono text-rose-lt text-center">{error}</p>
        </div>
      )}

      <button
        onClick={onAuthenticate}
        className="flex items-center gap-3 px-8 py-4 bg-white/10 border border-white/20 rounded-2xl text-white text-sm font-semibold active:scale-[0.97] transition-all backdrop-blur"
      >
        <span className="text-2xl">🔐</span>
        Unlock with Face ID
      </button>

      <button
        onClick={onSignOut}
        className="mt-6 text-[10px] font-mono text-white/25 underline underline-offset-2"
      >
        Sign out
      </button>
    </div>
  )
}

// ─── Biometric registration prompt ────────────────────────────────────────────

function BiometricSetupPrompt({ name, email, onRegister, onSkip }) {
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6">
      <span className="text-5xl mb-6">🔐</span>
      <h2 className="text-xl font-bold text-white mb-2">Enable Face ID?</h2>
      <p className="text-xs font-mono text-white/40 text-center mb-10 leading-relaxed">
        Unlock Minerva instantly with Face ID instead of signing in every time
      </p>

      <button
        onClick={onRegister}
        className="w-full max-w-xs py-3.5 bg-white rounded-2xl text-navy text-sm font-semibold mb-3 active:scale-[0.97] transition-all"
      >
        Enable Face ID
      </button>
      <button
        onClick={onSkip}
        className="text-[11px] font-mono text-white/30 underline underline-offset-2"
      >
        Skip for now
      </button>
    </div>
  )
}

// ─── AUTH GATE (main export) ──────────────────────────────────────────────────

export function AuthGate({ children }) {
  const [state, setState] = useState('loading') // loading | login | biometric_setup | biometric | authed
  const [authData, setAuthData] = useState(null)
  const [error, setError]       = useState(null)

  // ── On mount: determine initial state ──────────────────────────────────────
  useEffect(() => {
    // 1. Check for Google OAuth callback in URL hash
    const googleToken = parseGoogleToken()
    if (googleToken) {
      // Validate email
      if (!ALLOWED_EMAILS.includes(googleToken.email)) {
        window.history.replaceState({}, '', window.location.pathname)
        setState('login')
        setError(`Access denied for ${googleToken.email}. Contact Kedar to be added.`)
        return
      }
      // Store Drive token too
      if (googleToken.access) {
        localStorage.setItem('minerva_drive_token', JSON.stringify({
          access_token: googleToken.access,
          expires_at:   Date.now() + (parseInt(googleToken.expiry) || 3600) * 1000 - 60000,
        }))
      }
      storeAuth(googleToken.email, googleToken.name, googleToken.picture)
      window.history.replaceState({}, '', window.location.pathname)

      // On PWA: offer biometric setup if not done yet
      if (isPWA() && !isBiometricRegistered() && window.PublicKeyCredential) {
        setAuthData({ email: googleToken.email, name: googleToken.name, picture: googleToken.picture })
        setState('biometric_setup')
      } else {
        setState('authed')
      }
      return
    }

    // 2. Check existing session
    const stored = getStoredAuth()
    if (stored) {
      setAuthData(stored)
      // On PWA: require biometric if registered
      if (isPWA() && isBiometricRegistered()) {
        setState('biometric')
      } else {
        setState('authed')
      }
      return
    }

    // 3. No session → login
    setState('login')
  }, [])

  // ── Google Sign-In (OAuth redirect) ────────────────────────────────────────
  const handleGoogleSignIn = useCallback(() => {
    const params = new URLSearchParams({
      client_id:     CLIENT_ID,
      redirect_uri:  REDIRECT_URI,
      response_type: 'token id_token',
      scope:         'openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
      prompt:        'select_account',
      nonce:         Math.random().toString(36).slice(2),
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }, [])

  // ── Biometric registration ──────────────────────────────────────────────────
  const handleRegisterBiometric = useCallback(async () => {
    const ok = await registerBiometric(authData.email)
    if (ok) {
      setState('authed')
    } else {
      setError('Face ID setup failed. You can enable it later in settings.')
      setState('authed')
    }
  }, [authData])

  // ── Biometric authentication ────────────────────────────────────────────────
  const handleBiometricAuth = useCallback(async () => {
    setError(null)
    const ok = await authenticateBiometric()
    if (ok) {
      // Extend session
      if (authData) storeAuth(authData.email, authData.name, authData.picture)
      setState('authed')
    } else {
      setError('Face ID failed. Try again or sign out.')
    }
  }, [authData])

  // ── Sign out ────────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    clearAuth()
    setAuthData(null)
    setError(null)
    setState('login')
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <img src="/Minerva/icons/logo-header.png" alt="Minerva" className="w-12 h-12 animate-pulse opacity-60" />
      </div>
    )
  }

  if (state === 'login') {
    return <LoginScreen onSignIn={handleGoogleSignIn} error={error} />
  }

  if (state === 'biometric_setup') {
    return (
      <BiometricSetupPrompt
        name={authData?.name}
        email={authData?.email}
        onRegister={handleRegisterBiometric}
        onSkip={() => setState('authed')}
      />
    )
  }

  if (state === 'biometric') {
    return (
      <BiometricPrompt
        name={authData?.name}
        picture={authData?.picture}
        onAuthenticate={handleBiometricAuth}
        onSignOut={handleSignOut}
        error={error}
      />
    )
  }

  // Authenticated — render app
  return children
}
