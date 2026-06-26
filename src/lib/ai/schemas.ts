import type {
  GeneratedPlan, GeneratedExercise, ParsedLogEntry,
  WorkoutModification, ChatMessage,
} from '@/types'

export type { GeneratedPlan, GeneratedExercise, ParsedLogEntry, WorkoutModification, ChatMessage }

export interface GenerateWorkoutParams {
  goal: string
  daysPerWeek: number
  experience: string
  equipment: string
  focus: string
  durationMinutes: number
  limitations?: string
  keepCurrentSplit?: boolean
}

export interface ModifyWorkoutParams {
  planName: string
  exercises: GeneratedExercise[]
  request: string
}

export interface WeeklyData {
  checkIn?: import('@/types').WeeklyCheckIn
  sessionsCompleted: number
  avgWaterMl: number
  avgProteinG: number
  avgSteps: number
  avgSleepH: number
  streak: number
}

export interface WeeklySummary {
  narrative: string
  highlights: string[]
  recommendations: string[]
  nextWeekFocus: string
}
