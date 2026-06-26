export type CoachCategory =
  | 'hydration'
  | 'nutrition'
  | 'recovery'
  | 'activity'
  | 'overload'
  | 'progress'
  | 'adherence'

export interface CoachMessage {
  id: string
  priority: number    // 1 = highest
  category: CoachCategory
  title: string
  body: string
  actionLabel?: string
  actionPath?: string
}

export interface CoachContext {
  today: string       // YYYY-MM-DD
  hourOfDay: number   // 0-23
  profile: {
    waterGoalMl: number
    proteinGoalMinG: number
    proteinGoalMaxG: number
    stepsGoalMin: number
    stepsGoalMax: number
    sleepGoalMinH: number
    sleepGoalMaxH: number
    workoutDaysPerWeek?: number
    calorieTarget?: number
  }
  // Today's totals
  waterTodayMl: number
  proteinTodayG: number
  caloriesTodayKcal: number
  stepsToday: number
  // Sleep — hours slept for each of last N days (most recent first)
  sleepLast3Days: number[]
  // Weight — last 7 logged entries (most recent first)
  weightLast7Days: Array<{ date: string; weightKg: number }>
  // This week (Mon-Sun) counts of days where goal was met
  waterDaysThisWeek: number
  proteinDaysThisWeek: number
  stepsDaysThisWeek: number
  sleepDaysThisWeek: number
  workoutsThisWeek: number
}

export interface AdherenceScore {
  overall: number   // 0-100
  workouts: number
  protein: number
  water: number
  steps: number
  sleep: number
}
