import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { firestore, ensureAuth, isConfigured } from '@/firebase/config'
import { db, getProfile } from '@/db/db'
import { getSyncTables } from '@/data/tableRegistry'
import { resolveConflict } from '@/services/conflictResolver'
import type {
  LocalSyncFields,
  Profile,
} from '@/types'

export interface SyncFailureSummary {
  table: string
  count: number
  message: string
}

export type SyncResult = {
  success: boolean
  error?: string
  failures?: SyncFailureSummary[]
}

type UserRef = ReturnType<typeof doc>
type SyncableRecord = LocalSyncFields & {
  id: string
  [key: string]: unknown
}
type SyncTable<T extends SyncableRecord> = {
  toArray: () => Promise<T[]>
  get: (id: string) => Promise<T | undefined>
  put: (item: T) => Promise<unknown>
  update: (id: string, changes: Partial<T>) => Promise<unknown>
  filter: (fn: (item: T) => boolean) => { toArray: () => Promise<T[]>; count: () => Promise<number> }
}

let syncInProgress = false
let restoreInProgress = false

function subcollection(userRef: UserRef, name: string) {
  return collection(userRef.firestore, userRef.path, name)
}

function getFirebaseErrorMessage(err: unknown): string {
  const maybe = err as { code?: string; message?: string }
  if (maybe.code && maybe.message) return `${maybe.code}: ${maybe.message}`
  if (maybe.message) return maybe.message
  return 'Unknown sync error'
}

function needsSync(record: LocalSyncFields) {
  return record.pendingSync === true || record.syncStatus === 'error'
}

function normalizeForUser<T extends SyncableRecord>(record: T, uid: string, synced: boolean): T {
  const now = Date.now()
  const updatedAt = record.updatedAt ?? record.createdAt ?? now
  const createdAt = record.createdAt ?? updatedAt
  return {
    ...record,
    userId: uid,
    ownerId: uid,
    createdAt,
    updatedAt,
    pendingSync: !synced,
    syncStatus: synced ? 'synced' : 'pending',
  }
}

function removeUndefinedFields(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  )
}

function remotePayload<T extends SyncableRecord>(
  record: T,
  uid: string,
  sanitize?: (r: T) => Omit<T, 'dataUrl'>
): Record<string, unknown> {
  const normalized = normalizeForUser(record, uid, true)
  const sanitized = sanitize ? sanitize(normalized) : normalized
  const { lastSyncError: _lastSyncError, ...data } = sanitized as typeof normalized
  return removeUndefinedFields({
    ...data,
    syncedAt: Timestamp.now(),
  })
}

async function upsertDoc<T extends SyncableRecord>(
  userRef: UserRef,
  uid: string,
  collectionName: string,
  record: T,
  sanitize?: (r: T) => Omit<T, 'dataUrl'>
) {
  const ref = doc(subcollection(userRef, collectionName), record.id)
  await setDoc(ref, remotePayload(record, uid, sanitize), { merge: true })
}

async function markSynced<T extends SyncableRecord>(
  table: SyncTable<T>,
  record: T,
  uid: string
) {
  const normalized = normalizeForUser(record, uid, true)
  await table.update(record.id, {
    userId: uid,
    ownerId: uid,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    pendingSync: false,
    syncStatus: 'synced',
    lastSyncError: '',
  } as Partial<T>)
}

async function markFailed<T extends SyncableRecord>(
  table: SyncTable<T>,
  id: string,
  message: string
) {
  await table.update(id, {
    pendingSync: true,
    syncStatus: 'error',
    lastSyncError: message,
  } as Partial<T>)
}

function summarizeFailures(failures: SyncFailureSummary[]) {
  const total = failures.reduce((sum, failure) => sum + failure.count, 0)
  const first = failures[0]
  return first
    ? `Failed to sync ${total} item(s). ${first.table}: ${first.message}`
    : undefined
}

async function syncTableByName<T extends SyncableRecord>(
  userRef: UserRef,
  uid: string,
  tableName: string,
  table: SyncTable<T>,
  sanitize?: (r: T) => Omit<T, 'dataUrl'>
): Promise<SyncFailureSummary | null> {
  const pending = await table.filter(needsSync).toArray()
  let count = 0
  let message = ''

  for (const record of pending) {
    try {
      await upsertDoc(userRef, uid, tableName, record, sanitize)
      await markSynced(table, record, uid)
    } catch (err) {
      count += 1
      message = getFirebaseErrorMessage(err)
      await markFailed(table, record.id, message)
    }
  }

  return count > 0 ? { table: tableName, count, message } : null
}

async function syncProfile(userRef: UserRef, uid: string): Promise<SyncFailureSummary | null> {
  const profile = await getProfile()
  if (!needsSync(profile)) return null

  const remoteProfile = normalizeForUser({ ...profile, id: 'main' }, uid, true)

  try {
    await setDoc(doc(subcollection(userRef, 'profile'), 'main'), remotePayload(remoteProfile, uid), { merge: true })
    await db.profile.update('default', {
      userId: uid,
      ownerId: uid,
      createdAt: remoteProfile.createdAt,
      updatedAt: remoteProfile.updatedAt,
      pendingSync: false,
      syncStatus: 'synced',
      lastSyncError: '',
    })
    return null
  } catch (err) {
    const message = getFirebaseErrorMessage(err)
    await db.profile.update('default', { pendingSync: true, syncStatus: 'error', lastSyncError: message })
    return { table: 'profile', count: 1, message }
  }
}

export async function syncPendingChanges(): Promise<SyncResult> {
  if (syncInProgress) return { success: false, error: 'sync_already_running' }
  if (!navigator.onLine) return { success: false, error: 'offline' }
  if (!isConfigured) return { success: false, error: 'firebase_not_configured' }

  syncInProgress = true

  try {
    const user = await ensureAuth()
    if (!user || !firestore) return { success: false, error: 'auth_failed' }

    const uid = user.uid
    const userRef = doc(firestore, 'users', uid)
    const failures: SyncFailureSummary[] = []

    try {
      await setDoc(userRef, {
        userId: uid,
        ownerId: uid,
        updatedAt: Date.now(),
        syncedAt: Timestamp.now(),
      }, { merge: true })
    } catch (err) {
      const message = getFirebaseErrorMessage(err)
      return { success: false, error: message, failures: [{ table: 'users', count: 1, message }] }
    }

    const profileFailure = await syncProfile(userRef, uid)
    if (profileFailure) failures.push(profileFailure)

    // Use table registry to sync all eligible tables
    for (const entry of getSyncTables()) {
      if (entry.name === 'profile') continue  // handled separately above
      const table = entry.getTable() as unknown as SyncTable<SyncableRecord>
      const collectionName = entry.firestoreCollection ?? entry.name
      const sanitize = entry.sanitizeForSync as
        | ((r: SyncableRecord) => Omit<SyncableRecord, 'dataUrl'>)
        | undefined
      const failure = await syncTableByName(userRef, uid, collectionName, table, sanitize)
      if (failure) failures.push(failure)
    }

    if (failures.length > 0) {
      return { success: false, error: summarizeFailures(failures), failures }
    }

    return { success: true, failures: [] }
  } catch (err) {
    const error = getFirebaseErrorMessage(err)
    return { success: false, error }
  } finally {
    syncInProgress = false
  }
}

async function restoreProfile(userRef: UserRef, uid: string) {
  const snap = await getDoc(doc(subcollection(userRef, 'profile'), 'main'))
  if (!snap.exists()) return

  const remote = snap.data() as Profile
  const local = await getProfile()
  const resolved = resolveConflict('profile', { ...local, id: 'default' }, { ...remote, id: 'default' })
  if (!local || (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
    const merged = normalizeForUser({
      ...resolved,
      id: 'default',
    } as Profile & SyncableRecord, uid, true)
    await db.profile.put(merged as Profile)
  }
}

async function mergeCollection<T extends SyncableRecord>(
  uid: string,
  tableName: string,
  snap: Awaited<ReturnType<typeof getDocs>>,
  getLocal: (id: string) => Promise<T | undefined>,
  putLocal: (item: T) => Promise<unknown>
) {
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>
    const remoteUpdatedAt = typeof data.updatedAt === 'number'
      ? data.updatedAt
      : typeof data.createdAt === 'number'
        ? data.createdAt
        : 0
    const remote = normalizeForUser({
      ...data,
      id: d.id,
    } as SyncableRecord, uid, true)
    const local = await getLocal(d.id)
    const localUpdatedAt = local?.updatedAt ?? local?.createdAt ?? 0

    if (!local || remoteUpdatedAt > localUpdatedAt) {
      const resolved = local
        ? resolveConflict(tableName, local as SyncableRecord, remote as SyncableRecord)
        : remote
      await putLocal(resolved as T)
    }
  }
}

export async function downloadFromFirestore(): Promise<SyncResult> {
  if (restoreInProgress) return { success: false, error: 'restore_already_running' }
  if (!navigator.onLine) return { success: false, error: 'offline' }
  if (!isConfigured) return { success: false, error: 'firebase_not_configured' }

  restoreInProgress = true

  try {
    const user = await ensureAuth()
    if (!user || !firestore) return { success: false, error: 'auth_failed' }

    const uid = user.uid
    const userRef = doc(firestore, 'users', uid)
    const syncEntries = getSyncTables().filter((e) => e.name !== 'profile')

    const snaps = await Promise.all(
      syncEntries.map((entry) =>
        getDocs(subcollection(userRef, entry.firestoreCollection ?? entry.name))
      )
    )

    await restoreProfile(userRef, uid)

    for (let i = 0; i < syncEntries.length; i += 1) {
      const entry = syncEntries[i]
      const snap = snaps[i]
      if (!entry || !snap) continue
      const table = entry.getTable() as unknown as SyncTable<SyncableRecord>
      await mergeCollection(uid, entry.name, snap, id => table.get(id), item => table.put(item))
    }

    return { success: true }
  } catch (err) {
    const error = getFirebaseErrorMessage(err)
    return { success: false, error }
  } finally {
    restoreInProgress = false
  }
}

async function migrateTableToUser<T extends SyncableRecord>(
  uid: string,
  table: SyncTable<T>
): Promise<number> {
  const now = Date.now()
  const records = await table.toArray()
  let count = 0

  for (const record of records) {
    if (record.userId === uid && record.ownerId === uid) continue

    const updatedAt = record.updatedAt ?? record.createdAt ?? now
    await table.update(record.id, {
      userId: uid,
      ownerId: uid,
      createdAt: record.createdAt ?? updatedAt,
      updatedAt,
      pendingSync: true,
      syncStatus: 'pending',
      lastSyncError: '',
    } as Partial<T>)
    count += 1
  }

  return count
}

export async function migrateLocalRecordsToUser(uid: string): Promise<number> {
  const now = Date.now()
  let count = 0
  const profile = await getProfile()

  if (profile.userId !== uid || profile.ownerId !== uid) {
    await db.profile.update('default', {
      userId: uid,
      ownerId: uid,
      createdAt: profile.createdAt ?? profile.updatedAt ?? now,
      updatedAt: profile.updatedAt ?? now,
      pendingSync: true,
      syncStatus: 'pending',
      lastSyncError: '',
    })
    count += 1
  }

  for (const entry of getSyncTables()) {
    if (entry.name === 'profile') continue
    const table = entry.getTable() as unknown as SyncTable<SyncableRecord>
    count += await migrateTableToUser(uid, table)
  }

  return count
}

export async function getFailedSyncSummary(): Promise<SyncFailureSummary[]> {
  const failures: SyncFailureSummary[] = []
  const profileFailures = await db.profile.filter(p => p.syncStatus === 'error').toArray()
  if (profileFailures.length > 0) {
    failures.push({
      table: 'profile',
      count: profileFailures.length,
      message: profileFailures[0]?.lastSyncError || 'Profile sync failed',
    })
  }

  for (const entry of getSyncTables()) {
    if (entry.name === 'profile') continue
    const table = entry.getTable() as unknown as SyncTable<SyncableRecord>
    const rows = await table.filter((item) => item.syncStatus === 'error').toArray()
    if (rows.length > 0) {
      failures.push({
        table: entry.name,
        count: rows.length,
        message: rows[0]?.lastSyncError || 'Sync failed',
      })
    }
  }

  return failures
}

export async function countPending(): Promise<number> {
  const counts = await Promise.all([
    db.profile.filter(needsSync).count(),
    ...getSyncTables()
      .filter((e) => e.name !== 'profile')
      .map((entry) => {
        const table = entry.getTable() as unknown as SyncTable<SyncableRecord>
        return table.filter(needsSync).count()
      }),
  ])
  return counts.reduce((a, b) => a + b, 0)
}
