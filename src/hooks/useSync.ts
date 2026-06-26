import { useEffect, useCallback, useRef } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { useStore } from '@/store/useStore'
import { syncPendingChanges, countPending, getFailedSyncSummary } from '@/services/syncService'
import { isConfigured } from '@/firebase/config'

export function useSync() {
  const isOnline = useOnlineStatus()
  const {
    setSyncStatus,
    setPendingCount,
    setLastSyncedAt,
    setLastSyncAttemptAt,
    setSyncFailures,
    authUser,
  } = useStore()
  const runningRef = useRef(false)

  const runSync = useCallback(async () => {
    if (runningRef.current || !isOnline) return

    // Only sync when signed in with Google — anonymous and signed-out users stay local
    const isSignedIn = !!authUser && !authUser.isAnonymous
    if (!isSignedIn || !isConfigured) {
      const pending = await countPending()
      setPendingCount(pending)
      setSyncStatus(isOnline ? (pending > 0 ? 'pending' : 'synced') : 'offline')
      return
    }

    runningRef.current = true
    setLastSyncAttemptAt(Date.now())

    const pending = await countPending()
    const currentFailures = await getFailedSyncSummary()
    setPendingCount(pending)
    setSyncFailures(currentFailures)

    if (pending === 0) {
      setSyncStatus('synced')
      runningRef.current = false
      return
    }

    setSyncStatus('syncing')
    const result = await syncPendingChanges()

    if (result.success) {
      const remaining = await countPending()
      const failures = await getFailedSyncSummary()
      setPendingCount(remaining)
      setSyncFailures(failures)
      setSyncStatus(remaining > 0 ? 'pending' : 'synced')
      if (remaining === 0) setLastSyncedAt(Date.now())
    } else if (result.error === 'sync_already_running') {
      setSyncStatus('syncing')
    } else {
      setPendingCount(await countPending())
      setSyncFailures(result.failures ?? await getFailedSyncSummary())
      setSyncStatus('error', result.error)
    }

    runningRef.current = false
  }, [isOnline, authUser, setSyncStatus, setPendingCount, setLastSyncedAt, setLastSyncAttemptAt, setSyncFailures])

  // Respond to connectivity changes
  useEffect(() => {
    if (!isOnline) {
      setSyncStatus('offline')
    } else {
      runSync()
    }
  }, [isOnline, setSyncStatus, runSync])

  // Periodic sync every 60s when online
  useEffect(() => {
    if (!isOnline) return
    const interval = setInterval(runSync, 60_000)
    return () => clearInterval(interval)
  }, [isOnline, runSync])

  return { runSync }
}
