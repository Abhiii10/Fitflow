import { db } from '@/db/db'
import { getProfile } from '@/db/db'
import { evaluate, calculateAdherence } from './rules'
import type { CoachContext, CoachMessage, AdherenceScore } from './types'

export type { CoachContext, CoachMessage, AdherenceScore }

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function startOfWeek(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay() // 0=Sun, 1=Mon...
  const diff = (day === 0 ? -6 : 1 - day)  // Monday as week start
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

async function buildContext(): Promise<CoachContext> {
  const today = todayStr()
  const now = new Date()
  const hourOfDay = now.getHours()
  const profile = await getProfile()

  // Today's totals
  const waterLogs = await db.waterLogs.where('date').equals(today).filter(l => !l.deletedAt).toArray()
  const proteinLogs = await db.proteinLogs.where('date').equals(today).filter(l => !l.deletedAt).toArray()
  const macroLogs = await db.macroLogs.where('date').equals(today).filter(l => !l.deletedAt).toArray()
  const stepLogsToday = await db.stepLogs.where('date').equals(today).toArray()

  const waterTodayMl = waterLogs.reduce((s, l) => s + l.amountMl, 0)
  const proteinTodayG = proteinLogs.reduce((s, l) => s + l.amountG, 0)
    + macroLogs.reduce((s, l) => s + l.proteinG, 0)
  const caloriesTodayKcal = macroLogs.reduce((s, l) => s + l.calories, 0)
  const stepsToday = stepLogsToday.reduce((s, l) => s + l.steps, 0)

  // Sleep — last 3 days
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const sleepLogs = await db.sleepLogs
    .filter(l => !l.deletedAt && l.date >= threeDaysAgo.toISOString().slice(0, 10))
    .toArray()
  sleepLogs.sort((a, b) => b.date.localeCompare(a.date))
  const sleepLast3Days = sleepLogs.slice(0, 3).map(l => l.hoursSlept)

  // Weight — last 7 entries
  const allWeight = await db.weightLogs.orderBy('date').reverse().limit(14).toArray()
  const weightLast7Days = allWeight.slice(0, 7).map(l => ({ date: l.date, weightKg: l.weightKg }))

  // This week — Mon to today
  const weekStart = startOfWeek(today)

  const [weekWater, weekProtein, weekMacro, weekSteps, weekSleep, weekSessions] = await Promise.all([
    db.waterLogs.where('date').between(weekStart, today, true, true).filter(l => !l.deletedAt).toArray(),
    db.proteinLogs.where('date').between(weekStart, today, true, true).filter(l => !l.deletedAt).toArray(),
    db.macroLogs.where('date').between(weekStart, today, true, true).filter(l => !l.deletedAt).toArray(),
    db.stepLogs.where('date').between(weekStart, today, true, true).toArray(),
    db.sleepLogs.where('date').between(weekStart, today, true, true).filter(l => !l.deletedAt).toArray(),
    db.workoutSessions
      .filter(s => !s.deletedAt && !!s.completedAt && s.startedAt >= new Date(weekStart).getTime())
      .toArray(),
  ])

  // Days this week where goal was met
  function distinctDays(logs: Array<{ date: string }>): Set<string> {
    return new Set(logs.map(l => l.date))
  }

  const waterDays = distinctDays(weekWater)
  const proteinDays = distinctDays([...weekProtein, ...weekMacro])
  const stepsDays = distinctDays(weekSteps)
  const sleepDays = distinctDays(weekSleep)

  // Count days where water goal was met
  let waterDaysThisWeek = 0
  for (const date of waterDays) {
    const dayTotal = weekWater
      .filter(l => l.date === date)
      .reduce((s, l) => s + l.amountMl, 0)
    if (dayTotal >= profile.waterGoalMl * 0.9) waterDaysThisWeek++
  }

  // Count days where protein goal was met
  let proteinDaysThisWeek = 0
  for (const date of proteinDays) {
    const dayTotal =
      weekProtein.filter(l => l.date === date).reduce((s, l) => s + l.amountG, 0) +
      weekMacro.filter(l => l.date === date).reduce((s, l) => s + l.proteinG, 0)
    if (dayTotal >= profile.proteinGoalMinG * 0.9) proteinDaysThisWeek++
  }

  // Count days where steps goal was met
  let stepsDaysThisWeek = 0
  for (const date of stepsDays) {
    const dayTotal = weekSteps.filter(l => l.date === date).reduce((s, l) => s + l.steps, 0)
    if (dayTotal >= profile.stepsGoalMin * 0.8) stepsDaysThisWeek++
  }

  // Sleep days = days with any sleep logged (we trust the logged value)
  const sleepDaysThisWeek = sleepDays.size

  // Workouts = completed sessions this week
  const workoutsThisWeek = weekSessions.length

  return {
    today,
    hourOfDay,
    profile: {
      waterGoalMl: profile.waterGoalMl,
      proteinGoalMinG: profile.proteinGoalMinG,
      proteinGoalMaxG: profile.proteinGoalMaxG,
      stepsGoalMin: profile.stepsGoalMin,
      stepsGoalMax: profile.stepsGoalMax,
      sleepGoalMinH: profile.sleepGoalMinH,
      sleepGoalMaxH: profile.sleepGoalMaxH,
      workoutDaysPerWeek: profile.workoutDaysPerWeek,
      calorieTarget: profile.calorieTarget,
    },
    waterTodayMl,
    proteinTodayG,
    caloriesTodayKcal,
    stepsToday,
    sleepLast3Days,
    weightLast7Days,
    waterDaysThisWeek,
    proteinDaysThisWeek,
    stepsDaysThisWeek,
    sleepDaysThisWeek,
    workoutsThisWeek,
  }
}

export interface CoachResult {
  messages: CoachMessage[]
  adherence: AdherenceScore
  context: CoachContext
}

export async function runCoach(): Promise<CoachResult> {
  const ctx = await buildContext()
  const messages = evaluate(ctx)
  const adherence = calculateAdherence(ctx)
  return { messages, adherence, context: ctx }
}
