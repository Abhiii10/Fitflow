import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithPopup,
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { db } from '@/db/db'

// ── Environment diagnostics ──────────────────────────────────────────────────

export function getConfiguredAuthDomain(): string {
  return import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '(not set)'
}

// ── Platform detection ───────────────────────────────────────────────────────

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isStandalonePWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// iOS standalone PWA: redirect auth navigates away but lands in Safari (different
// window context), so getRedirectResult never fires in the PWA. Detect this case
// separately so we can show a "sign in from Safari" instruction instead.
export function isIOSStandalonePWA(): boolean {
  return isIOS() && isStandalonePWA()
}

// Prefer popup for normal browsers, including Safari. It is started by a direct
// tap/click and avoids Safari's brittle redirect storage path.
function shouldUseRedirect(): boolean {
  return false
}

// ── Mark all local data pending (for UID migration) ──────────────────────────

export async function markAllLocalDataPending(): Promise<void> {
  await Promise.allSettled([
    db.profile.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.waterLogs.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.workoutPlans.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.exercises.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.workoutSessions.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.sessionExerciseLogs.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.proteinLogs.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.stepLogs.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.cardioLogs.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.sleepLogs.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.weeklyCheckIns.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.exerciseDemos.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.routineItems.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
    db.aiGeneratedDrafts.toCollection().modify({ pendingSync: true, syncStatus: 'pending' }),
  ])
}

// ── Friendly error messages ───────────────────────────────────────────────────

export function friendlyAuthError(err: unknown): string {
  const e = err as { code?: string; message?: string }
  switch (e.code) {
    case 'auth/configuration-not-found':
      return 'Firebase Auth is not configured. Enable Google Sign-In in Firebase Console → Authentication → Sign-in method.'
    case 'auth/unauthorized-domain':
      return `Domain not authorized. Add "${window.location.hostname}" to Firebase Console → Authentication → Settings → Authorized domains.`
    case 'auth/operation-not-allowed':
      return 'Google Sign-In is not enabled. Enable it in Firebase Console → Authentication → Sign-in method → Google.'
    case 'auth/popup-blocked':
      return 'Popup was blocked by the browser. Retrying with redirect sign-in.'
    case 'auth/cancelled-popup-request':
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/email-already-in-use':
      return 'That email already has an account. Use sign in instead.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Email or password is incorrect.'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.'
    case 'auth/credential-already-in-use':
      return 'This Google account is already linked to another sign-in. Switching to that account...'
    default:
      return e.message ?? 'Sign-in failed. Please try again.'
  }
}

// ── Sign-in result types ─────────────────────────────────────────────────────

export type SignInResult =
  | { status: 'signed_in'; user: User }
  | { status: 'redirect_initiated' }
  | { status: 'open_safari'; url: string }  // iOS standalone: user must open Safari
  | { status: 'error'; message: string; code?: string }

const POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/popup-closed-by-user',
])

// ── Main sign-in function ────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<SignInResult> {
  const provider = new GoogleAuthProvider()
  provider.addScope('profile')
  provider.addScope('email')

  // iOS Home Screen PWA: redirect navigates away into Safari and the result lands
  // in Safari's context, not the PWA's. Guide the user to sign in via Safari instead.
  if (isIOSStandalonePWA()) {
    return { status: 'open_safari', url: `${window.location.origin}/settings?signin=google` }
  }

  const currentUser = auth.currentUser
  const useRedirect = shouldUseRedirect()

  // ── Anonymous user: try to link ──────────────────────────────────────────
  if (currentUser?.isAnonymous) {
    try {
      if (useRedirect) {
        await markAllLocalDataPending()
        await signInWithRedirect(auth, provider)
        return { status: 'redirect_initiated' }
      }
      const result = await linkWithPopup(currentUser, provider)
      return { status: 'signed_in', user: result.user }
    } catch (err: unknown) {
      const e = err as { code?: string }

      if (e.code === 'auth/credential-already-in-use') {
        await markAllLocalDataPending()
        const cred = GoogleAuthProvider.credentialFromError(
          err as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]
        )
        if (cred) {
          try {
            const r = await signInWithCredential(auth, cred)
            return { status: 'signed_in', user: r.user }
          } catch (credErr: unknown) {
            const msg = friendlyAuthError(credErr)
            return { status: 'error', message: msg, code: (credErr as { code?: string }).code }
          }
        }
        return { status: 'error', message: 'Could not retrieve credential. Please try again.' }
      }

      if (e.code && POPUP_FALLBACK_CODES.has(e.code)) {
        try {
          await markAllLocalDataPending()
          await signInWithRedirect(auth, provider)
          return { status: 'redirect_initiated' }
        } catch (redirectErr: unknown) {
          return { status: 'error', message: friendlyAuthError(redirectErr), code: (redirectErr as { code?: string }).code }
        }
      }

      return { status: 'error', message: friendlyAuthError(err), code: e.code }
    }
  }

  // ── Fresh sign-in ────────────────────────────────────────────────────────
  if (useRedirect) {
    try {
      await signInWithRedirect(auth, provider)
      return { status: 'redirect_initiated' }
    } catch (err: unknown) {
      return { status: 'error', message: friendlyAuthError(err), code: (err as { code?: string }).code }
    }
  }

  try {
    const result = await signInWithPopup(auth, provider)
    return { status: 'signed_in', user: result.user }
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e.code && POPUP_FALLBACK_CODES.has(e.code)) {
      try {
        await signInWithRedirect(auth, provider)
        return { status: 'redirect_initiated' }
      } catch (redirectErr: unknown) {
        return { status: 'error', message: friendlyAuthError(redirectErr), code: (redirectErr as { code?: string }).code }
      }
    }
    return { status: 'error', message: friendlyAuthError(err), code: e.code }
  }
}

export async function createAccountWithEmail(email: string, password: string): Promise<SignInResult> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await markAllLocalDataPending()
    return { status: 'signed_in', user: result.user }
  } catch (err) {
    return { status: 'error', message: friendlyAuthError(err), code: (err as { code?: string }).code }
  }
}

export async function signInWithEmail(email: string, password: string): Promise<SignInResult> {
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim(), password)
    await markAllLocalDataPending()
    return { status: 'signed_in', user: result.user }
  } catch (err) {
    return { status: 'error', message: friendlyAuthError(err), code: (err as { code?: string }).code }
  }
}

export async function sendPasswordReset(email: string): Promise<{ success: true } | { success: false; message: string; code?: string }> {
  try {
    await sendPasswordResetEmail(auth, email.trim())
    return { success: true }
  } catch (err) {
    return { success: false, message: friendlyAuthError(err), code: (err as { code?: string }).code }
  }
}

// ── Redirect result handler (call once on app startup) ───────────────────────

export type RedirectResultOutcome =
  | { status: 'signed_in'; user: User }
  | { status: 'no_result' }
  | { status: 'error'; message: string; code?: string }

export async function handleGoogleRedirectResult(): Promise<RedirectResultOutcome> {
  try {
    const result = await getRedirectResult(auth)
    if (result?.user) return { status: 'signed_in', user: result.user }
    return { status: 'no_result' }
  } catch (err) {
    const e = err as { code?: string }
    return { status: 'error', message: friendlyAuthError(err), code: e.code }
  }
}

// ── Sign out ─────────────────────────────────────────────────────────────────

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth)
}

// ── Auth state subscription ───────────────────────────────────────────────────

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}
