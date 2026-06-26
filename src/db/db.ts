import Dexie, { type Table } from 'dexie'
import type {
  Profile, WaterLog, ProteinLog, StepLog, CardioLog, SleepLog,
  WorkoutPlan, Exercise, WorkoutSession, SessionExerciseLog,
  SyncQueueItem, ActiveSession, WeeklyCheckIn, ExerciseDemo, AIGeneratedDraft, RoutineItem, MacroLog,
  WeightLog, PhotoLog,
} from '@/types'

class FitFlowDB extends Dexie {
  profile!: Table<Profile>
  waterLogs!: Table<WaterLog>
  proteinLogs!: Table<ProteinLog>
  stepLogs!: Table<StepLog>
  cardioLogs!: Table<CardioLog>
  sleepLogs!: Table<SleepLog>
  workoutPlans!: Table<WorkoutPlan>
  exercises!: Table<Exercise>
  workoutSessions!: Table<WorkoutSession>
  sessionExerciseLogs!: Table<SessionExerciseLog>
  syncQueue!: Table<SyncQueueItem>
  activeSession!: Table<ActiveSession & { id: string }>
  weeklyCheckIns!: Table<WeeklyCheckIn>
  exerciseDemos!: Table<ExerciseDemo>
  routineItems!: Table<RoutineItem>
  aiGeneratedDrafts!: Table<AIGeneratedDraft>
  macroLogs!: Table<MacroLog>
  weightLogs!: Table<WeightLog>
  photoLogs!: Table<PhotoLog>

  constructor() {
    super('fitflow')

    this.version(1).stores({
      profile: 'id',
      waterLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      workoutPlans: 'id, pendingSync, deletedAt',
      exercises: 'id, planId, order, pendingSync, deletedAt',
      workoutSessions: 'id, planId, startedAt, pendingSync, deletedAt',
      sessionExerciseLogs: 'id, sessionId, exerciseId, pendingSync',
      syncQueue: 'id, table, recordId, createdAt',
      activeSession: 'id',
    })

    this.version(2).stores({
      profile: 'id',
      waterLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      proteinLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      stepLogs: 'id, date, pendingSync',
      cardioLogs: 'id, date, loggedAt, pendingSync',
      sleepLogs: 'id, date, pendingSync',
      workoutPlans: 'id, pendingSync, deletedAt',
      exercises: 'id, planId, order, pendingSync, deletedAt',
      workoutSessions: 'id, planId, startedAt, pendingSync, deletedAt',
      sessionExerciseLogs: 'id, sessionId, exerciseId, pendingSync',
      syncQueue: 'id, table, recordId, createdAt',
      activeSession: 'id',
      weeklyCheckIns: 'id, weekStartDate, pendingSync',
      exerciseDemos: 'id, exerciseName',
      aiGeneratedDrafts: 'id, type, createdAt',
    }).upgrade(async (tx) => {
      const profile = await tx.table('profile').get('default')
      if (profile) {
        await tx.table('profile').put({
          ...profile,
          proteinGoalMinG: profile.proteinGoalMinG ?? 140,
          proteinGoalMaxG: profile.proteinGoalMaxG ?? 160,
          stepsGoalMin: profile.stepsGoalMin ?? 8000,
          stepsGoalMax: profile.stepsGoalMax ?? 12000,
          sleepGoalMinH: profile.sleepGoalMinH ?? 7,
          sleepGoalMaxH: profile.sleepGoalMaxH ?? 9,
        })
      }
    })

    this.version(3).stores({
      profile: 'id',
      waterLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      proteinLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      stepLogs: 'id, date, pendingSync',
      cardioLogs: 'id, date, loggedAt, pendingSync',
      sleepLogs: 'id, date, pendingSync',
      workoutPlans: 'id, pendingSync, deletedAt',
      exercises: 'id, planId, order, pendingSync, deletedAt',
      workoutSessions: 'id, planId, startedAt, pendingSync, deletedAt',
      sessionExerciseLogs: 'id, sessionId, exerciseId, pendingSync',
      syncQueue: 'id, table, recordId, createdAt',
      activeSession: 'id',
      weeklyCheckIns: 'id, weekStartDate, pendingSync',
      exerciseDemos: 'id, exerciseName',
      routineItems: 'id, enabled, pendingSync, deletedAt',
      aiGeneratedDrafts: 'id, type, createdAt',
    }).upgrade(async (tx) => {
      const now = Date.now()
      await tx.table('routineItems').bulkPut([
        {
          id: 'creatine',
          title: 'Creatine',
          time: '13:00',
          dayNumbers: [0, 1, 2, 3, 4, 5],
          color: 'cyan',
          notes: 'Take creatine before your gym block.',
          enabled: true,
          reminderEnabled: true,
          reminderOffsetMinutes: 0,
          updatedAt: now,
          pendingSync: false,
          syncStatus: 'synced',
        },
        {
          id: 'gym',
          title: 'Gym',
          time: '14:00',
          dayNumbers: [0, 1, 2, 3, 4, 5],
          color: 'green',
          notes: 'Training time. Sunday to Friday.',
          enabled: true,
          reminderEnabled: true,
          reminderOffsetMinutes: 0,
          updatedAt: now,
          pendingSync: false,
          syncStatus: 'synced',
        },
      ])
    })

    this.version(4).stores({
      profile: 'id',
      waterLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      proteinLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      stepLogs: 'id, date, pendingSync',
      cardioLogs: 'id, date, loggedAt, pendingSync',
      sleepLogs: 'id, date, pendingSync',
      workoutPlans: 'id, pendingSync, deletedAt',
      exercises: 'id, planId, order, pendingSync, deletedAt',
      workoutSessions: 'id, planId, startedAt, pendingSync, deletedAt',
      sessionExerciseLogs: 'id, sessionId, exerciseId, pendingSync',
      syncQueue: 'id, table, recordId, createdAt',
      activeSession: 'id',
      weeklyCheckIns: 'id, weekStartDate, pendingSync',
      exerciseDemos: 'id, exerciseName',
      routineItems: 'id, enabled, pendingSync, deletedAt',
      aiGeneratedDrafts: 'id, type, createdAt',
    }).upgrade(async (tx) => {
      await tx.table('routineItems').toCollection().modify((item) => {
        if (item.reminderEnabled === undefined) item.reminderEnabled = true
        if (item.reminderOffsetMinutes === undefined) item.reminderOffsetMinutes = 0
      })
    })

    this.version(5).stores({
      profile: 'id',
      waterLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      proteinLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      stepLogs: 'id, date, pendingSync',
      cardioLogs: 'id, date, loggedAt, pendingSync',
      sleepLogs: 'id, date, pendingSync',
      workoutPlans: 'id, pendingSync, deletedAt',
      exercises: 'id, planId, order, pendingSync, deletedAt',
      workoutSessions: 'id, planId, startedAt, pendingSync, deletedAt',
      sessionExerciseLogs: 'id, sessionId, exerciseId, pendingSync',
      syncQueue: 'id, table, recordId, createdAt',
      activeSession: 'id',
      weeklyCheckIns: 'id, weekStartDate, pendingSync',
      exerciseDemos: 'id, exerciseName',
      routineItems: 'id, enabled, pendingSync, deletedAt',
      aiGeneratedDrafts: 'id, type, createdAt',
    }).upgrade(async (tx) => {
      const profile = await tx.table('profile').get('default')
      if (profile && profile.waterGoalMl === 2500) {
        await tx.table('profile').put({ ...profile, waterGoalMl: 3500 })
      }
    })

    this.version(6).stores({
      profile: 'id',
      waterLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      proteinLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      stepLogs: 'id, date, pendingSync',
      cardioLogs: 'id, date, loggedAt, pendingSync',
      sleepLogs: 'id, date, pendingSync',
      workoutPlans: 'id, pendingSync, deletedAt',
      exercises: 'id, planId, order, pendingSync, deletedAt',
      workoutSessions: 'id, planId, startedAt, pendingSync, deletedAt',
      sessionExerciseLogs: 'id, sessionId, exerciseId, pendingSync',
      syncQueue: 'id, table, recordId, createdAt',
      activeSession: 'id',
      weeklyCheckIns: 'id, weekStartDate, pendingSync',
      exerciseDemos: 'id, exerciseName',
      routineItems: 'id, enabled, pendingSync, deletedAt',
      aiGeneratedDrafts: 'id, type, createdAt',
      macroLogs: 'id, date, loggedAt, pendingSync, deletedAt',
    })

    this.version(7).stores({
      profile: 'id',
      waterLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      proteinLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      stepLogs: 'id, date, pendingSync',
      cardioLogs: 'id, date, loggedAt, pendingSync',
      sleepLogs: 'id, date, pendingSync',
      workoutPlans: 'id, pendingSync, deletedAt',
      exercises: 'id, planId, order, pendingSync, deletedAt',
      workoutSessions: 'id, planId, startedAt, pendingSync, deletedAt',
      sessionExerciseLogs: 'id, sessionId, exerciseId, pendingSync',
      syncQueue: 'id, table, recordId, createdAt',
      activeSession: 'id',
      weeklyCheckIns: 'id, weekStartDate, pendingSync',
      exerciseDemos: 'id, exerciseName',
      routineItems: 'id, enabled, pendingSync, deletedAt',
      aiGeneratedDrafts: 'id, type, createdAt',
      macroLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      weightLogs: 'id, date, updatedAt',
      photoLogs: 'id, date, updatedAt',
    })

    // Version 8: adds pendingSync/deletedAt indexes to weightLogs and photoLogs
    // to enable Firestore sync for those tables.
    this.version(8).stores({
      profile: 'id',
      waterLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      proteinLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      stepLogs: 'id, date, pendingSync',
      cardioLogs: 'id, date, loggedAt, pendingSync',
      sleepLogs: 'id, date, pendingSync',
      workoutPlans: 'id, pendingSync, deletedAt',
      exercises: 'id, planId, order, pendingSync, deletedAt',
      workoutSessions: 'id, planId, startedAt, pendingSync, deletedAt',
      sessionExerciseLogs: 'id, sessionId, exerciseId, pendingSync',
      syncQueue: 'id, table, recordId, createdAt',
      activeSession: 'id',
      weeklyCheckIns: 'id, weekStartDate, pendingSync',
      exerciseDemos: 'id, exerciseName',
      routineItems: 'id, enabled, pendingSync, deletedAt',
      aiGeneratedDrafts: 'id, type, createdAt',
      macroLogs: 'id, date, loggedAt, pendingSync, deletedAt',
      weightLogs: 'id, date, updatedAt, pendingSync, deletedAt',
      photoLogs: 'id, date, updatedAt, pendingSync, deletedAt',
    }).upgrade(async (tx) => {
      const now = Date.now()
      await tx.table('weightLogs').toCollection().modify((r) => {
        if (r.pendingSync === undefined) r.pendingSync = false
        if (r.syncStatus === undefined) r.syncStatus = 'synced'
        if (r.createdAt === undefined) r.createdAt = r.updatedAt ?? now
      })
      await tx.table('photoLogs').toCollection().modify((r) => {
        if (r.pendingSync === undefined) r.pendingSync = false
        if (r.syncStatus === undefined) r.syncStatus = 'synced'
        if (r.createdAt === undefined) r.createdAt = r.updatedAt ?? now
      })
    })
  }
}

export const db = new FitFlowDB()

// ─── Profile helpers ─────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile> {
  let profile = await db.profile.get('default')
  if (!profile) {
    profile = {
      id: 'default',
      waterGoalMl: 3500,
      proteinGoalMinG: 140,
      proteinGoalMaxG: 160,
      stepsGoalMin: 8000,
      stepsGoalMax: 12000,
      sleepGoalMinH: 7,
      sleepGoalMaxH: 9,
      defaultRestSeconds: 90,
      timerSoundEnabled: true,
      vibrationEnabled: true,
      workoutDaysPerWeek: 4,
      goalMode: 'cut',
      updatedAt: Date.now(),
      pendingSync: false,
      syncStatus: 'synced',
    }
    await db.profile.put(profile)
  }
  return profile
}

export async function updateProfile(updates: Partial<Omit<Profile, 'id'>>): Promise<void> {
  const current = await getProfile()
  await db.profile.put({ ...current, ...updates, updatedAt: Date.now(), pendingSync: true, syncStatus: 'pending' })
}

// ─── Active session helpers ───────────────────────────────────────────────────

export async function getActiveSession(): Promise<import('@/types').ActiveSession | null> {
  const record = await db.activeSession.get('current')
  if (!record) return null
  const { id: _id, ...session } = record
  return session as import('@/types').ActiveSession
}

export async function saveActiveSession(session: import('@/types').ActiveSession): Promise<void> {
  await db.activeSession.put({ ...session, id: 'current' })
}

export async function clearActiveSession(): Promise<void> {
  await db.activeSession.delete('current')
}

export async function seedRoutineItems(): Promise<void> {
  const count = await db.routineItems.count()
  if (count > 0) return

  const now = Date.now()
  await db.routineItems.bulkPut([
    {
      id: 'creatine',
      title: 'Creatine',
      time: '13:00',
      dayNumbers: [0, 1, 2, 3, 4, 5],
      color: 'cyan',
      notes: 'Take creatine before your gym block.',
      enabled: true,
      reminderEnabled: true,
      reminderOffsetMinutes: 0,
      updatedAt: now,
      pendingSync: false,
      syncStatus: 'synced',
    },
    {
      id: 'gym',
      title: 'Gym',
      time: '14:00',
      dayNumbers: [0, 1, 2, 3, 4, 5],
      color: 'green',
      notes: 'Training time. Sunday to Friday.',
      enabled: true,
      reminderEnabled: true,
      reminderOffsetMinutes: 0,
      updatedAt: now,
      pendingSync: false,
      syncStatus: 'synced',
    },
  ])
}
