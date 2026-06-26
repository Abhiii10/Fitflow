import { useEffect, useState } from 'react'
import { createAccountWithEmail, sendPasswordReset, signInWithEmail, signInWithGoogle, signOutUser } from '@/lib/auth/authService'
import { useStore } from '@/store/useStore'
import { countPending } from '@/services/syncService'

interface Props {
  onSignedIn?: () => void
}

export function SignInCard({ onSignedIn }: Props) {
  const { lastAuthError, setLastAuthError } = useStore()
  const [loading, setLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [localError, setLocalError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [redirecting, setRedirecting] = useState(false)
  const [openSafariUrl, setOpenSafariUrl] = useState('')
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const error = localError || lastAuthError || ''

  async function handleAuth() {
    setLoading(true)
    setLocalError('')
    setSuccessMsg('')
    setLastAuthError(null)
    try {
      const result = await signInWithGoogle()
      // 'redirect_initiated' means the page will navigate away to Google —
      // setRedirecting(true) may not visibly render before navigation, that's fine
      if (result.status === 'redirect_initiated') {
        setRedirecting(true)
      } else if (result.status === 'signed_in') {
        onSignedIn?.()
      } else if (result.status === 'open_safari') {
        setOpenSafariUrl(result.url)
      } else {
        setLocalError(result.message)
      }
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : 'Sign-in failed')
    }
    setLoading(false)
  }

  async function handleEmailAuth() {
    setEmailLoading(true)
    setLocalError('')
    setSuccessMsg('')
    setLastAuthError(null)

    if (!email.trim() || !password) {
      setLocalError('Enter your email and password.')
      setEmailLoading(false)
      return
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setLocalError('Passwords do not match.')
      setEmailLoading(false)
      return
    }
    if (mode === 'signup' && password.length < 6) {
      setLocalError('Password should be at least 6 characters.')
      setEmailLoading(false)
      return
    }

    const result = mode === 'signup'
      ? await createAccountWithEmail(email, password)
      : await signInWithEmail(email, password)

    if (result.status === 'signed_in') {
      setSuccessMsg(mode === 'signup' ? 'Account created. Starting cloud backup...' : 'Signed in. Restoring backup...')
      onSignedIn?.()
    } else if (result.status === 'error') {
      setLocalError(result.message)
    }
    setEmailLoading(false)
  }

  async function handlePasswordReset() {
    setLocalError('')
    setSuccessMsg('')
    setLastAuthError(null)

    if (!email.trim()) {
      setLocalError('Enter your email first, then tap forgot password.')
      return
    }

    const result = await sendPasswordReset(email)
    if (result.success) {
      setSuccessMsg('Password reset email sent. Check your inbox.')
    } else {
      setLocalError(result.message)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('signin') !== 'google') return

    params.delete('signin')
    const nextSearch = params.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)

    void handleAuth()
    // Run once on mount only. This handles the Safari handoff URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Google OAuth inside iOS Home Screen may need Safari, but email/password
  // sign-up stays available directly in the installed app.
  if (openSafariUrl) {
    return (
      <div className="card space-y-3">
        <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest">Account</div>
        <div className="p-3 rounded-lg border border-cyber-cyan/30 bg-cyber-cyan/5 space-y-2">
          <div className="text-xs font-mono text-cyber-cyan font-semibold">Create account via Safari</div>
          <div className="text-xs text-cyber-dim font-mono leading-relaxed">
            iPhone Home Screen apps can't complete Google account setup directly.
            Tap below to open in Safari, create or sign in there, then return to this app.
            Your account will be active when you come back.
          </div>
        </div>
        {error && (
          <div className="p-2 rounded border border-red-400/30 bg-red-400/5 text-red-400 text-xs font-mono break-words">
            {error}
          </div>
        )}
        <a
          href={openSafariUrl || `${window.location.origin}/settings?signin=google`}
          target="_self"
          className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-cyber-cyan/40 bg-cyber-panel hover:bg-cyber-panel/80 transition-colors"
          onClick={() => setOpenSafariUrl('')}
        >
          <GoogleIcon />
          <span className="font-mono text-sm text-cyber-cyan">Open Safari to Create Account</span>
        </a>
        <p className="text-[10px] font-mono text-cyber-dim/60 text-center">
          Already have one? Use the same button and choose your Google account.
        </p>
      </div>
    )
  }

  if (redirecting) {
    return (
      <div className="card text-center py-6 space-y-2">
        <div className="w-5 h-5 border-2 border-cyber-dim border-t-cyber-green rounded-full animate-spin mx-auto" />
        <div className="text-xs font-mono text-cyber-dim">Opening Google account flow...</div>
        <div className="text-xs text-cyber-dim/60 font-mono">
          You'll be brought back automatically after account setup.
        </div>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <div>
        <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-1">Account</div>
        <div className="text-sm text-cyber-text">
          {mode === 'signup' ? 'Create an account to sync your data and keep a cloud backup.' : 'Sign in to restore your cloud backup.'}
        </div>
      </div>

      {error && (
        <div className="p-2 rounded border border-red-400/30 bg-red-400/5 text-red-400 text-xs font-mono break-words">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-2 rounded border border-cyber-green/30 bg-cyber-green/5 text-cyber-green text-xs font-mono break-words">
          {successMsg}
        </div>
      )}

      <div className="space-y-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="input-field"
        />
        <input
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="input-field"
        />
        {mode === 'signup' && (
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            className="input-field"
          />
        )}
      </div>

      <button
        onClick={handleEmailAuth}
        disabled={emailLoading}
        className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-cyber-green/40 bg-cyber-green/10 hover:bg-cyber-green/15 text-cyber-green transition-colors disabled:opacity-50"
      >
        {emailLoading && <span className="w-4 h-4 border-2 border-cyber-dim border-t-cyber-green rounded-full animate-spin" />}
        <span className="font-mono text-sm font-semibold">
          {emailLoading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </span>
      </button>

      <button
        onClick={() => {
          setLocalError('')
          setSuccessMsg('')
          setLastAuthError(null)
          setMode(mode === 'signup' ? 'signin' : 'signup')
        }}
        disabled={emailLoading}
        className="w-full py-2 rounded-lg border border-cyber-border text-cyber-dim font-mono text-xs hover:border-cyber-cyan/40 hover:text-cyber-cyan transition-colors disabled:opacity-50"
      >
        {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
      </button>

      {mode === 'signin' && (
        <button
          type="button"
          onClick={handlePasswordReset}
          className="w-full py-1 text-[11px] font-mono text-cyber-cyan hover:underline"
        >
          Forgot password?
        </button>
      )}

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-cyber-border" />
        <span className="text-[10px] font-mono text-cyber-dim">OR</span>
        <div className="h-px flex-1 bg-cyber-border" />
      </div>

      <button
        onClick={handleAuth}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-cyber-border bg-cyber-panel hover:border-cyber-green/40 hover:bg-cyber-panel/80 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-cyber-dim border-t-cyber-green rounded-full animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        <span className="font-mono text-xs text-cyber-text">
          {loading ? 'Opening Google...' : 'Continue with Google'}
        </span>
      </button>

      <p className="text-[10px] font-mono text-cyber-dim/60 text-center">
        Your data stays on-device even without sign-in.
        Account setup enables cloud backup.
      </p>
    </div>
  )
}

interface SignOutButtonProps {
  onSignedOut?: () => void
  className?: string
}

export function SignOutButton({ onSignedOut, className = '' }: SignOutButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  async function handlePressSignOut() {
    const count = await countPending()
    setPendingCount(count)
    setShowConfirm(true)
  }

  async function confirmSignOut() {
    setLoading(true)
    await signOutUser()
    setLoading(false)
    setShowConfirm(false)
    onSignedOut?.()
  }

  if (showConfirm) {
    return (
      <div className="space-y-2">
        {pendingCount > 0 && (
          <div className="p-2 rounded border border-yellow-400/30 bg-yellow-400/5 text-yellow-400 text-xs font-mono">
            {pendingCount} unsynced item{pendingCount !== 1 ? 's' : ''} will remain on this device.
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfirm(false)}
            className="flex-1 py-2 rounded-lg border border-cyber-border text-cyber-dim font-mono text-sm"
          >
            Cancel
          </button>
          <button
            onClick={confirmSignOut}
            disabled={loading}
            className="flex-1 py-2 rounded-lg border border-red-400/40 text-red-400 font-mono text-sm hover:bg-red-400/5 disabled:opacity-40"
          >
            {loading ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={handlePressSignOut}
      className={`py-2 px-4 rounded-lg border border-cyber-border text-cyber-dim font-mono text-sm hover:border-red-400/40 hover:text-red-400 transition-colors ${className}`}
    >
      Sign out
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  )
}
