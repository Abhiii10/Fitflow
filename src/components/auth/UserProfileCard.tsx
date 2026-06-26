import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { signInWithGoogle } from '@/lib/auth/authService'
import { SignOutButton } from './SignInCard'

export function UserProfileCard() {
  const { authUser } = useStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  if (!authUser) return null

  const isGoogle = authUser.providerId === 'google.com'
  const providerLabel = isGoogle ? 'Google' : authUser.providerId === 'password' ? 'Email' : 'Account'

  async function handleUpgrade() {
    setLoading(true)
    setError('')
    try {
      const result = await signInWithGoogle()
      if (result.status === 'redirect_initiated') {
        setRedirecting(true)
      } else if (result.status === 'error') {
        setError(result.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
    }
    setLoading(false)
  }

  return (
    <div className="card space-y-3">
      <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest">Account</div>

      <div className="flex items-center gap-3">
        {authUser.photoURL ? (
          <img
            src={authUser.photoURL}
            alt={authUser.displayName ?? 'User'}
            className="w-10 h-10 rounded-full border border-cyber-border"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-10 h-10 rounded-full border border-cyber-border bg-cyber-panel flex items-center justify-center">
            <span className="text-cyber-green font-mono font-bold text-base">
              {(authUser.displayName ?? authUser.email ?? '?')[0].toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {authUser.displayName && (
            <div className="text-sm font-semibold text-cyber-text truncate">{authUser.displayName}</div>
          )}
          {authUser.email && (
            <div className="text-xs text-cyber-dim font-mono truncate">{authUser.email}</div>
          )}
        </div>

        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border flex-shrink-0 ${
          isGoogle
            ? 'text-cyber-green border-cyber-green/30 bg-cyber-green/5'
            : 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5'
        }`}>
          {authUser.isAnonymous ? 'Anonymous' : providerLabel}
        </span>
      </div>

      {authUser.isAnonymous && (
        <div className="space-y-2">
          <div className="p-2 rounded border border-yellow-400/20 bg-yellow-400/5 text-xs text-yellow-400 font-mono">
            Signed in anonymously. Link Google to keep this backup permanently.
          </div>
          {error && (
            <div className="p-2 rounded border border-red-400/30 bg-red-400/5 text-red-400 text-xs font-mono">
              {error}
            </div>
          )}
          {redirecting && (
            <div className="p-2 rounded border border-cyber-cyan/30 bg-cyber-cyan/5 text-cyber-cyan text-xs font-mono">
              Redirecting to Google...
            </div>
          )}
          <button
            onClick={handleUpgrade}
            disabled={loading || redirecting}
            className="w-full py-3 rounded-xl border border-cyber-green/40 text-cyber-green font-mono text-sm hover:bg-cyber-green/5 transition-colors disabled:opacity-50"
          >
            {loading ? 'Opening Google...' : 'Continue with Google'}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-cyber-border/50">
        <span className="text-[10px] font-mono text-cyber-dim/60 truncate max-w-[60%]">
          uid: {authUser.uid.slice(0, 16)}...
        </span>
        <SignOutButton />
      </div>
    </div>
  )
}
