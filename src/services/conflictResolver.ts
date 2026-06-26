import type { LocalSyncFields, Profile } from '@/types'

type AnyRecord = LocalSyncFields & { id: string; [key: string]: unknown }

// ─── Resolution policies ──────────────────────────────────────────────────────

/**
 * Default: higher version wins; if equal, later updatedAtServer wins;
 * if equal, later updatedAt wins. Tombstone always wins.
 */
export function resolveDefault(local: AnyRecord, remote: AnyRecord): AnyRecord {
  // Tombstone wins: if either side is deleted, the record is deleted
  if (remote.deletedAt && !local.deletedAt) return { ...local, ...remote }
  if (local.deletedAt && !remote.deletedAt) return { ...local, deletedAt: local.deletedAt }

  // Higher version wins
  const localVersion = (local.version as number | undefined) ?? 0
  const remoteVersion = (remote.version as number | undefined) ?? 0
  if (remoteVersion > localVersion) return { ...local, ...remote }
  if (localVersion > remoteVersion) return local

  // Same version — later server timestamp wins
  const localServerTs = (local.updatedAtServer as number | undefined) ?? 0
  const remoteServerTs = (remote.updatedAtServer as number | undefined) ?? 0
  if (remoteServerTs > localServerTs) return { ...local, ...remote }
  if (localServerTs > remoteServerTs) return local

  // Fall back to updatedAt
  const localTs = local.updatedAt ?? 0
  const remoteTs = remote.updatedAt ?? 0
  return remoteTs > localTs ? { ...local, ...remote } : local
}

/**
 * Profile/settings: field-wise merge — remote value wins per field unless
 * the local field is newer. Useful for settings that may change on different
 * devices independently.
 */
export function resolveProfile(local: Profile, remote: Profile): Profile {
  if (remote.deletedAt && !local.deletedAt) return { ...local, ...remote } as Profile
  if (local.deletedAt && !remote.deletedAt) return local

  const localTs = local.updatedAt ?? 0
  const remoteTs = remote.updatedAt ?? 0

  // Simple: if remote is newer, prefer remote but keep any local-only fields
  if (remoteTs >= localTs) {
    return {
      ...local,
      ...remote,
      id: local.id,  // always keep local id ('default')
    } as Profile
  }
  return local
}

/**
 * One-record-per-day: only one record allowed per date. Remote wins if
 * remote updatedAt is newer. Used for stepLogs, sleepLogs, weightLogs.
 */
export function resolveDailyRecord(local: AnyRecord, remote: AnyRecord): AnyRecord {
  if (remote.deletedAt) return { ...local, ...remote }
  if (local.deletedAt) return local
  const localTs = local.updatedAt ?? 0
  const remoteTs = remote.updatedAt ?? 0
  return remoteTs > localTs ? { ...local, ...remote } : local
}

/**
 * One-per-weekStartDate: weekly check-ins. Remote wins if newer.
 */
export function resolveWeeklyCheckIn(local: AnyRecord, remote: AnyRecord): AnyRecord {
  return resolveDailyRecord(local, remote)
}

/**
 * Photo logs: metadata merge only. Never overwrite local dataUrl unless
 * the local record has no dataUrl at all.
 */
export function resolvePhotoLog(
  local: AnyRecord & { dataUrl?: string },
  remote: AnyRecord,
): AnyRecord & { dataUrl?: string } {
  const base = resolveDefault(local, remote) as AnyRecord & { dataUrl?: string }
  // Always prefer local dataUrl — remote never has it (stripped before sync)
  if (local.dataUrl) base.dataUrl = local.dataUrl
  return base
}

// ─── Dispatch ──────────────────────────────────────────────────────────────────

export type TableName =
  | 'profile'
  | 'weightLogs'
  | 'stepLogs'
  | 'sleepLogs'
  | 'weeklyCheckIns'
  | 'photoLogs'
  | string

export function resolveConflict(
  tableName: TableName,
  local: AnyRecord,
  remote: AnyRecord,
): AnyRecord {
  switch (tableName) {
    case 'profile':
      return resolveProfile(local as unknown as Profile, remote as unknown as Profile) as unknown as AnyRecord
    case 'weightLogs':
    case 'stepLogs':
    case 'sleepLogs':
      return resolveDailyRecord(local, remote)
    case 'weeklyCheckIns':
      return resolveWeeklyCheckIn(local, remote)
    case 'photoLogs':
      return resolvePhotoLog(local as AnyRecord & { dataUrl?: string }, remote)
    default:
      return resolveDefault(local, remote)
  }
}

/**
 * Ensure a record has the minimum sync metadata fields.
 * Called when importing old records that predate sync support.
 */
export function ensureSyncMetadata(record: AnyRecord, now: number): AnyRecord {
  return {
    ...record,
    createdAt: record.createdAt ?? record.updatedAt ?? now,
    updatedAt: record.updatedAt ?? now,
    pendingSync: record.pendingSync ?? false,
    syncStatus: record.syncStatus ?? 'synced',
  }
}
