export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'offline' | 'error'
export type RecordSyncStatus = 'pending' | 'synced' | 'error'
export type DayType = 'heavy' | 'light' | 'rest' | 'active-recovery'
export type Intensity = 'heavy' | 'light' | 'pump'
export type GoalMode = 'cut' | 'maintain' | 'lean-bulk'

export interface LocalSyncFields {
  userId?: string
  ownerId?: string
  createdAt?: number
  updatedAt?: number
  deletedAt?: number
  pendingSync?: boolean
  syncStatus?: RecordSyncStatus
  lastSyncError?: string
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface Profile extends LocalSyncFields {
  id: string
  // Hydration
  waterGoalMl: number
  // Nutrition
  proteinGoalMinG: number
  proteinGoalMaxG: number
  calorieTarget?: number
  // Activity
  stepsGoalMin: number
  stepsGoalMax: number
  // Sleep
  sleepGoalMinH: number
  sleepGoalMaxH: number
  // Workout
  defaultRestSeconds: number
  timerSoundEnabled: boolean
  vibrationEnabled: boolean
  workoutDaysPerWeek?: number
  // Body composition goals
  currentWeightKg?: number
  targetWeightKg?: number
  heightCm?: number
  goalMode?: GoalMode
  // Required sync fields
  updatedAt: number
  pendingSync: boolean
  syncStatus?: RecordSyncStatus
}

// ─── Water ───────────────────────────────────────────────────────────────────

export interface WaterLog extends LocalSyncFields {
  id: string
  amountMl: number
  loggedAt: number
  date: string
  updatedAt: number
  deletedAt?: number
  pendingSync: boolean
  syncStatus?: RecordSyncStatus
}

// ─── Nutrition ────────────────────────────────────────────────────────────────

export interface ProteinLog extends LocalSyncFields {
  id: string
  amountG: number
  mealName?: string
  loggedAt: number
  date: string
  updatedAt: number
  deletedAt?: number
  pendingSync: boolean
  syncStatus?: RecordSyncStatus
}

export interface MacroLog extends LocalSyncFields {
  id: string
  date: string
  mealName: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  loggedAt: number
  updatedAt: number
  deletedAt?: number
  pendingSync: boolean
  syncStatus?: RecordSyncStatus
}

// ─── Steps / Cardio ──────────────────────────────────────────────────────────

export interface StepLog extends LocalSyncFields {
  id: string
  steps: number
  date: string
  updatedAt: number
  deletedAt?: number
  pendingSync: boolean
  syncStatus?: RecordSyncStatus
}

export interface CardioLog extends LocalSyncFields {
  id: string
  type: string
  durationMinutes: number
  notes?: string
  date: string
  loggedAt: number
  updatedAt: number
  deletedAt?: number
  pendingSync: boolean
  syncStatus?: RecordSyncStatus
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

export interface SleepLog extends LocalSyncFields {
  id: string
  hoursSlept: number
  quality: 1 | 2 | 3 | 4 | 5
  notes?: string
  date: string
  updatedAt: number
  deletedAt?: number
  pendingSync: boolean
  syncStatus?: RecordSyncStatus
}

// ─── Workouts ────────────────────────────────────────────────────────────────

export interface WorkoutPlan extends LocalSyncFields {
  id: string
  name: string
  description?: string
  daysOfWeek: number[]
  dayType?: DayType
  cardioTarget?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
  pendingSync: boolean
  syncStatus?: RecordSyncStatus
}

export interface Exercise extends LocalSyncFields {
  id: string
  planId: string
  name: string
  sets: number
  reps?: number
  repRangeMin?: number
  repRangeMax?: number
  durationSeconds?: number
  restSeconds: number
  order: number
  notes?: string
  targetMuscles?: string[]
  equipment?: string
  intensity?: Intensity
  rirTarget?: number
  formCues?: string[]
  updatedAt: number
  deletedAt?: number
  pendingSync: boolean
  syncStatus?: RecordSyncStatus
}

export interface WorkoutSession extends LocalSyncFields {
  id: string
  planId: string
  planName: string
  startedAt: number
  completedAt?: number
  durationSeconds?: number
  updatedAt: number
  deletedAt?: number
  pendingSync: boolean
  syncStatus?: RecordSyncStatus
}

export interface SessionExerciseLog extends LocalSyncFields {
  id: string
  sessionId: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  repsCompleted?: number
  weightKg?: number
  durationSeconds?: number
  completedAt: number
  updatedAt: number
  deletedAt?: number
  pendingSync: boolean
  syncStatus?: RecordSyncStatus
}

export interface SyncQueueItem {
  id: string
  table: string
  recordId: string
  operation: 'upsert' | 'delete'
  data?: Record<string, unknown>
  createdAt: number
  attempts: number
  lastError?: string
}

export interface ActiveSession {
  sessionId: string
  planId: string
  planName: string
  exercises: Exercise[]
  currentExerciseIndex: number
  currentSet: number
  phase: 'exercise' | 'rest' | 'complete'
  phaseEndTime: number | null
  startedAt: number
  logs: SessionExerciseLog[]
}

// ─── Weekly Check-in ─────────────────────────────────────────────────────────

export interface WeeklyCheckIn extends LocalSyncFields {
  id: string
  weekStartDate: string
  weightKg?: number
  waistCm?: number
  sessionsCompleted: number
  avgDailySteps?: number
  avgProteinG?: number
  avgSleepH?: number
  notes?: string
  completedAt: number
  updatedAt: number
  pendingSync: boolean
  deletedAt?: number
  syncStatus?: RecordSyncStatus
}

// ─── Exercise Demo ────────────────────────────────────────────────────────────

export interface ExerciseDemo extends LocalSyncFields {
  id: string
  exerciseName: string
  targetMuscles: string[]
  equipment: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  frontViewPath?: string
  sideViewPath?: string
  backViewPath?: string
  instructions: string[]
  commonMistakes: string[]
  safetyNotes: string[]
  updatedAt: number
}

export interface RoutineItem extends LocalSyncFields {
  id: string
  title: string
  time: string
  dayNumbers: number[]
  color: 'green' | 'cyan' | 'yellow' | 'red' | 'purple'
  notes?: string
  enabled: boolean
  reminderEnabled: boolean
  reminderOffsetMinutes: number
  updatedAt: number
  deletedAt?: number
  pendingSync: boolean
}

// ─── Daily Weight ─────────────────────────────────────────────────────────────
// Now includes LocalSyncFields for optional Firestore sync.
// dataUrl-style fields are not present here — weight is just a number.

export interface WeightLog extends LocalSyncFields {
  id: string
  date: string
  weightKg: number
  note?: string
  createdAt?: number
  updatedAt: number
  deletedAt?: number
  pendingSync?: boolean
  syncStatus?: RecordSyncStatus
}

// ─── Progress Photos ──────────────────────────────────────────────────────────
// dataUrl is local-only — never synced to Firestore (size/cost limits).
// Firestore sync only includes metadata (id, date, note, updatedAt, etc.).
// Full photos are included in local JSON backup/export.

export interface PhotoLog extends LocalSyncFields {
  id: string
  date: string
  dataUrl: string  // base64 data URL — local only, excluded from Firestore sync
  note?: string
  createdAt?: number
  updatedAt: number
  deletedAt?: number
  pendingSync?: boolean
  syncStatus?: RecordSyncStatus
}

// ─── AI Drafts ────────────────────────────────────────────────────────────────

export interface AIGeneratedDraft extends LocalSyncFields {
  id: string
  type: 'workout-plan' | 'modification' | 'weekly-summary' | 'nl-log'
  prompt: string
  content: string
  createdAt: number
  approved: boolean
}

// ─── AI Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

export interface GeneratedExercise {
  name: string
  sets: number
  reps?: number
  repRangeMin?: number
  repRangeMax?: number
  durationSeconds?: number
  restSeconds: number
  rirTarget?: number
  formCues?: string[]
  notes?: string
}

export interface GeneratedPlan {
  name: string
  description: string
  dayType?: DayType
  cardioTarget?: string
  daysOfWeek: number[]
  exercises: GeneratedExercise[]
}

export interface ParsedLogEntry {
  type: 'water' | 'protein' | 'steps' | 'cardio' | 'sleep' | 'exercise-set'
  data: Record<string, unknown>
  description: string
}

export interface ModifiedExercise {
  original: string
  replacement: string
  reason: string
}

export interface WorkoutModification {
  summary: string
  changes: ModifiedExercise[]
  exercises: GeneratedExercise[]
}
