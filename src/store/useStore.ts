import { create } from 'zustand'
import type { SyncStatus, ActiveSession, Profile } from '@/types'

export interface SyncFailureSummary {
  table: string
  count: number
  message: string
}

export interface AuthUser {
  uid: string
  isAnonymous: boolean
  displayName: string | null
  email: string | null
  photoURL: string | null
  providerId?: string | null
}

interface AppStore {
  syncStatus: SyncStatus
  syncError: string | null
  setSyncStatus: (status: SyncStatus, error?: string | null) => void

  lastSyncedAt: number | null
  setLastSyncedAt: (ts: number) => void

  lastSyncAttemptAt: number | null
  setLastSyncAttemptAt: (ts: number) => void

  lastRestoredAt: number | null
  setLastRestoredAt: (ts: number) => void

  syncFailures: SyncFailureSummary[]
  setSyncFailures: (failures: SyncFailureSummary[]) => void

  activeSession: ActiveSession | null
  setActiveSession: (session: ActiveSession | null) => void

  profile: Profile | null
  setProfile: (profile: Profile) => void

  pendingCount: number
  setPendingCount: (count: number) => void

  authUser: AuthUser | null
  setAuthUser: (user: AuthUser | null) => void

  lastAuthError: string | null
  setLastAuthError: (err: string | null) => void
}

const LAST_SYNC_KEY = 'fitflow_last_sync'
const LAST_SYNC_ATTEMPT_KEY = 'fitflow_last_sync_attempt'
const LAST_RESTORE_KEY = 'fitflow_last_restore'

function loadStoredTime(key: string): number | null {
  try {
    const v = localStorage.getItem(key)
    return v ? parseInt(v, 10) : null
  } catch {
    return null
  }
}

function saveStoredTime(key: string, ts: number) {
  try { localStorage.setItem(key, String(ts)) } catch { /* ignore */ }
}

export const useStore = create<AppStore>((set) => ({
  syncStatus: 'offline',
  syncError: null,
  setSyncStatus: (status, error = undefined) =>
    set({ syncStatus: status, syncError: error ?? null }),

  lastSyncedAt: loadStoredTime(LAST_SYNC_KEY),
  setLastSyncedAt: (ts) => {
    saveStoredTime(LAST_SYNC_KEY, ts)
    set({ lastSyncedAt: ts })
  },

  lastSyncAttemptAt: loadStoredTime(LAST_SYNC_ATTEMPT_KEY),
  setLastSyncAttemptAt: (ts) => {
    saveStoredTime(LAST_SYNC_ATTEMPT_KEY, ts)
    set({ lastSyncAttemptAt: ts })
  },

  lastRestoredAt: loadStoredTime(LAST_RESTORE_KEY),
  setLastRestoredAt: (ts) => {
    saveStoredTime(LAST_RESTORE_KEY, ts)
    set({ lastRestoredAt: ts })
  },

  syncFailures: [],
  setSyncFailures: (failures) => set({ syncFailures: failures }),

  activeSession: null,
  setActiveSession: (session) => set({ activeSession: session }),

  profile: null,
  setProfile: (profile) => set({ profile }),

  pendingCount: 0,
  setPendingCount: (count) => set({ pendingCount: count }),

  authUser: null,
  setAuthUser: (user) => set({ authUser: user }),

  lastAuthError: null,
  setLastAuthError: (err) => set({ lastAuthError: err }),
}))
