import { db } from '@/db/db'
import type { Profile, WeightLog, PhotoLog } from '@/types'

export type ExportMode = 'full' | 'metadata-only' | 'skip'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TableEntry<T = any> {
  /** Dexie table name and default Firestore collection name */
  name: string
  /** Key used in backup JSON file */
  exportKey: string
  /** Returns the Dexie table reference */
  getTable: () => import('dexie').Table<T>
  /** Include in export/import JSON backup */
  isBackupEligible: boolean
  /** Push to Firestore when online */
  isSyncEligible: boolean
  /** Never leaves the device — not synced, not exported to cloud */
  isLocalOnly: boolean
  /** Firestore sub-collection name under users/{uid} */
  firestoreCollection: string | null
  /**
   * How to export this table:
   * - 'full': export all fields including binary data (for local backup)
   * - 'metadata-only': strip large binary fields (photos dataUrl) for Firestore
   * - 'skip': never export
   */
  exportMode: ExportMode
  /** Basic sanity check for import validation */
  validate: (record: unknown) => boolean
  /** Strip fields that must not go to Firestore (e.g. photo blobs) */
  sanitizeForSync?: (record: T) => Omit<T, 'dataUrl'>
}

function hasId(r: unknown): r is { id: string } {
  return typeof r === 'object' && r !== null && typeof (r as Record<string, unknown>).id === 'string'
}

function hasIdAndDate(r: unknown): r is { id: string; date: string } {
  return hasId(r) && typeof (r as Record<string, unknown>).date === 'string'
}

const CURRENT_SCHEMA_VERSION = 8

export const TABLE_REGISTRY: TableEntry[] = [
  // ── Profile ────────────────────────────────────────────────────────────────
  {
    name: 'profile',
    exportKey: 'profile',
    getTable: () => db.profile as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'profile',
    exportMode: 'full',
    validate: (r): boolean =>
      hasId(r) && typeof (r as Record<string, unknown>).waterGoalMl === 'number',
  },

  // ── Water ──────────────────────────────────────────────────────────────────
  {
    name: 'waterLogs',
    exportKey: 'waterLogs',
    getTable: () => db.waterLogs as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'waterLogs',
    exportMode: 'full',
    validate: (r): boolean =>
      hasIdAndDate(r) && typeof (r as Record<string, unknown>).amountMl === 'number',
  },

  // ── Protein ────────────────────────────────────────────────────────────────
  {
    name: 'proteinLogs',
    exportKey: 'proteinLogs',
    getTable: () => db.proteinLogs as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'proteinLogs',
    exportMode: 'full',
    validate: (r): boolean =>
      hasIdAndDate(r) && typeof (r as Record<string, unknown>).amountG === 'number',
  },

  // ── Macros ─────────────────────────────────────────────────────────────────
  {
    name: 'macroLogs',
    exportKey: 'macroLogs',
    getTable: () => db.macroLogs as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'macroLogs',
    exportMode: 'full',
    validate: (r): boolean =>
      hasIdAndDate(r) && typeof (r as Record<string, unknown>).calories === 'number',
  },

  // ── Steps ──────────────────────────────────────────────────────────────────
  {
    name: 'stepLogs',
    exportKey: 'stepLogs',
    getTable: () => db.stepLogs as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'stepLogs',
    exportMode: 'full',
    validate: (r): boolean =>
      hasIdAndDate(r) && typeof (r as Record<string, unknown>).steps === 'number',
  },

  // ── Cardio ─────────────────────────────────────────────────────────────────
  {
    name: 'cardioLogs',
    exportKey: 'cardioLogs',
    getTable: () => db.cardioLogs as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'cardioLogs',
    exportMode: 'full',
    validate: (r): boolean =>
      hasIdAndDate(r) && typeof (r as Record<string, unknown>).durationMinutes === 'number',
  },

  // ── Sleep ──────────────────────────────────────────────────────────────────
  {
    name: 'sleepLogs',
    exportKey: 'sleepLogs',
    getTable: () => db.sleepLogs as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'sleepLogs',
    exportMode: 'full',
    validate: (r): boolean =>
      hasIdAndDate(r) && typeof (r as Record<string, unknown>).hoursSlept === 'number',
  },

  // ── Weight ─────────────────────────────────────────────────────────────────
  {
    name: 'weightLogs',
    exportKey: 'weightLogs',
    getTable: () => db.weightLogs as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'weightLogs',
    exportMode: 'full',
    validate: (r): boolean =>
      hasIdAndDate(r) && typeof (r as Record<string, unknown>).weightKg === 'number',
  },

  // ── Progress Photos ────────────────────────────────────────────────────────
  // Included in local backup with full dataUrl (may be large).
  // Firestore sync strips dataUrl and only stores metadata.
  {
    name: 'photoLogs',
    exportKey: 'photoLogs',
    getTable: () => db.photoLogs as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'photoLogs',
    exportMode: 'full',
    validate: (r): boolean =>
      hasIdAndDate(r) && typeof (r as Record<string, unknown>).dataUrl === 'string',
    sanitizeForSync: (r: PhotoLog): Omit<PhotoLog, 'dataUrl'> => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { dataUrl: _, ...metadata } = r
      return metadata
    },
  },

  // ── Workout Plans ──────────────────────────────────────────────────────────
  {
    name: 'workoutPlans',
    exportKey: 'workoutPlans',
    getTable: () => db.workoutPlans as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'workoutPlans',
    exportMode: 'full',
    validate: (r): boolean =>
      hasId(r) && typeof (r as Record<string, unknown>).name === 'string',
  },

  // ── Exercises ──────────────────────────────────────────────────────────────
  {
    name: 'exercises',
    exportKey: 'exercises',
    getTable: () => db.exercises as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'exercises',
    exportMode: 'full',
    validate: (r): boolean =>
      hasId(r) &&
      typeof (r as Record<string, unknown>).planId === 'string' &&
      typeof (r as Record<string, unknown>).name === 'string',
  },

  // ── Workout Sessions ───────────────────────────────────────────────────────
  {
    name: 'workoutSessions',
    exportKey: 'workoutSessions',
    getTable: () => db.workoutSessions as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'workoutSessions',
    exportMode: 'full',
    validate: (r): boolean =>
      hasId(r) && typeof (r as Record<string, unknown>).planId === 'string',
  },

  // ── Session Exercise Logs ──────────────────────────────────────────────────
  {
    name: 'sessionExerciseLogs',
    exportKey: 'sessionExerciseLogs',
    getTable: () => db.sessionExerciseLogs as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'sessionExerciseLogs',
    exportMode: 'full',
    validate: (r): boolean =>
      hasId(r) && typeof (r as Record<string, unknown>).sessionId === 'string',
  },

  // ── Weekly Check-ins ───────────────────────────────────────────────────────
  {
    name: 'weeklyCheckIns',
    exportKey: 'weeklyCheckIns',
    getTable: () => db.weeklyCheckIns as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'weeklyCheckIns',
    exportMode: 'full',
    validate: (r): boolean =>
      hasId(r) && typeof (r as Record<string, unknown>).weekStartDate === 'string',
  },

  // ── Routine Items ──────────────────────────────────────────────────────────
  {
    name: 'routineItems',
    exportKey: 'routineItems',
    getTable: () => db.routineItems as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'routineItems',
    exportMode: 'full',
    validate: (r): boolean =>
      hasId(r) && typeof (r as Record<string, unknown>).title === 'string',
  },

  // ── AI Generated Drafts ────────────────────────────────────────────────────
  {
    name: 'aiGeneratedDrafts',
    exportKey: 'aiGeneratedDrafts',
    getTable: () => db.aiGeneratedDrafts as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: true,
    isLocalOnly: false,
    firestoreCollection: 'aiGeneratedDrafts',
    exportMode: 'full',
    validate: (r): boolean =>
      hasId(r) && typeof (r as Record<string, unknown>).content === 'string',
  },

  // ── Exercise Demos ─────────────────────────────────────────────────────────
  // App-seeded static data. Backup-eligible so user customizations are preserved.
  // Not sync-eligible — always seeded from the app bundle.
  {
    name: 'exerciseDemos',
    exportKey: 'exerciseDemos',
    getTable: () => db.exerciseDemos as import('dexie').Table,
    isBackupEligible: true,
    isSyncEligible: false,
    isLocalOnly: true,
    firestoreCollection: null,
    exportMode: 'full',
    validate: (r): boolean =>
      hasId(r) && typeof (r as Record<string, unknown>).exerciseName === 'string',
  },

  // ── Active Session ─────────────────────────────────────────────────────────
  // Ephemeral in-progress workout — never backed up or synced.
  {
    name: 'activeSession',
    exportKey: 'activeSession',
    getTable: () => db.activeSession as import('dexie').Table,
    isBackupEligible: false,
    isSyncEligible: false,
    isLocalOnly: true,
    firestoreCollection: null,
    exportMode: 'skip',
    validate: (): boolean => true,
  },

  // ── Sync Queue ─────────────────────────────────────────────────────────────
  // Internal sync bookkeeping — local only.
  {
    name: 'syncQueue',
    exportKey: 'syncQueue',
    getTable: () => db.syncQueue as import('dexie').Table,
    isBackupEligible: false,
    isSyncEligible: false,
    isLocalOnly: true,
    firestoreCollection: null,
    exportMode: 'skip',
    validate: (): boolean => true,
  },
]

export const SCHEMA_VERSION = CURRENT_SCHEMA_VERSION

export function getBackupTables(): TableEntry[] {
  return TABLE_REGISTRY.filter((e) => e.isBackupEligible)
}

export function getSyncTables(): TableEntry[] {
  return TABLE_REGISTRY.filter((e) => e.isSyncEligible && !e.isLocalOnly)
}

export function getTableByName(name: string): TableEntry | undefined {
  return TABLE_REGISTRY.find((e) => e.name === name)
}

export function getTableByExportKey(key: string): TableEntry | undefined {
  return TABLE_REGISTRY.find((e) => e.exportKey === key)
}

// Types re-exported so callers don't need to import from @/types for these
export type { Profile, WeightLog, PhotoLog }
