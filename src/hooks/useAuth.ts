import { useRef, useState, useEffect } from 'react'
import type { User } from 'firebase/auth'
import { subscribeToAuthState, handleGoogleRedirectResult } from '@/lib/auth/authService'
import { useStore } from '@/store/useStore'
import { getProfile } from '@/db/db'
import {
  countPending,
  downloadFromFirestore,
  getFailedSyncSummary,
  migrateLocalRecordsToUser,
  syncPendingChanges,
} from '@/services/syncService'

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAnonymous: boolean
  isGoogleSignedIn: boolean
  uid: string | null
  displayName: string | null
  email: string | null
  photoURL: string | null
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const restoredIdentityRef = useRef<string | null>(null)
  const redirectHandledRef = useRef(false)
  const {
    setAuthUser,
    setLastRestoredAt,
    setPendingCount,
    setProfile,
    setSyncFailures,
    setSyncStatus,
    setLastSyncedAt,
    setLastAuthError,
  } = useStore()

  useEffect(() => {
    // Handle pending redirect result exactly once on startup
    if (!redirectHandledRef.current) {
      redirectHandledRef.current = true
      handleGoogleRedirectResult().then((outcome) => {
        if (outcome.status === 'error') {
          setLastAuthError(outcome.message)
        } else {
          // 'signed_in' or 'no_result' — clear any previous auth error
          setLastAuthError(null)
        }
      })
    }

    const unsubscribe = subscribeToAuthState((u) => {
      setUser(u)
      setIsLoading(false)

      // Only treat Google-signed-in users as "signed in" — anonymous = not signed in
      const isGoogle = !!u && !u.isAnonymous
      setAuthUser(
        isGoogle
          ? {
              uid: u!.uid,
              isAnonymous: false,
              displayName: u!.displayName,
              email: u!.email,
              photoURL: u!.photoURL,
              providerId: u!.providerData[0]?.providerId ?? null,
            }
          : null
      )

      if (!isGoogle || !navigator.onLine) return

      const identityKey = u!.uid
      if (restoredIdentityRef.current === identityKey) return
      restoredIdentityRef.current = identityKey

      void (async () => {
        setSyncStatus('syncing')
        await migrateLocalRecordsToUser(u!.uid)

        const restoreResult = await downloadFromFirestore()
        if (restoreResult.success) {
          setLastRestoredAt(Date.now())
        } else if (restoreResult.error !== 'restore_already_running') {
          setSyncStatus('error', restoreResult.error)
          setSyncFailures(restoreResult.failures ?? (await getFailedSyncSummary()))
          return
        }

        const syncResult = await syncPendingChanges()
        const profile = await getProfile()
        const pending = await countPending()
        const failures = syncResult.failures ?? (await getFailedSyncSummary())
        setProfile(profile)
        setPendingCount(pending)
        setSyncFailures(failures)

        if (syncResult.success) {
          if (pending === 0) setLastSyncedAt(Date.now())
          setSyncStatus(pending > 0 ? 'pending' : 'synced')
        } else if (syncResult.error === 'sync_already_running') {
          setSyncStatus('syncing')
        } else {
          setSyncStatus('error', syncResult.error)
        }
      })()
    })
    return unsubscribe
  }, [setAuthUser, setLastRestoredAt, setLastSyncedAt, setPendingCount, setProfile, setSyncFailures, setSyncStatus, setLastAuthError])

  return {
    user,
    isLoading,
    isAnonymous: user?.isAnonymous ?? false,
    isGoogleSignedIn: !!user && !user.isAnonymous,
    uid: user?.uid ?? null,
    displayName: user?.displayName ?? null,
    email: user?.email ?? null,
    photoURL: user?.photoURL ?? null,
  }
}
