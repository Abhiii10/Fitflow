import type { CoachContext, CoachMessage, AdherenceScore } from './types'

// ─── Individual rules ─────────────────────────────────────────────────────────

/** Hydration afternoon gap: after 2pm, if water is below 50% of goal */
export function checkHydration(ctx: CoachContext): CoachMessage | null {
  if (ctx.hourOfDay < 14) return null
  const pct = ctx.waterTodayMl / ctx.profile.waterGoalMl
  if (pct >= 0.5) return null
  const remaining = Math.round(ctx.profile.waterGoalMl - ctx.waterTodayMl)
  return {
    id: 'hydration-afternoon',
    priority: 2,
    category: 'hydration',
    title: 'Drink more water',
    body: `You're ${remaining} ml short of your daily goal and it's afternoon. Staying hydrated improves performance and recovery.`,
    actionLabel: 'Log water',
    actionPath: '/water',
  }
}

/** Protein evening gap: after 6pm, if protein is below 70% of min goal */
export function checkProtein(ctx: CoachContext): CoachMessage | null {
  if (ctx.hourOfDay < 18) return null
  const goal = ctx.profile.proteinGoalMinG
  const pct = ctx.proteinTodayG / goal
  if (pct >= 0.7) return null
  const remaining = Math.round(goal - ctx.proteinTodayG)
  return {
    id: 'protein-evening',
    priority: 2,
    category: 'nutrition',
    title: 'Protein gap tonight',
    body: `You need ~${remaining} g more protein today. A quick protein meal or shake can close the gap before bed.`,
    actionLabel: 'Log nutrition',
    actionPath: '/nutrition',
  }
}

/** Low sleep recovery: avg sleep over last 3 days below 6.5h */
export function checkSleep(ctx: CoachContext): CoachMessage | null {
  if (ctx.sleepLast3Days.length < 2) return null
  const avg = ctx.sleepLast3Days.reduce((a, b) => a + b, 0) / ctx.sleepLast3Days.length
  if (avg >= 6.5) return null
  return {
    id: 'low-sleep',
    priority: 1,
    category: 'recovery',
    title: 'Sleep debt detected',
    body: `Your average sleep over the last ${ctx.sleepLast3Days.length} days is ${avg.toFixed(1)} h — below optimal. Consider prioritizing sleep tonight.`,
    actionLabel: 'Log sleep',
    actionPath: '/steps',
  }
}

/** Low steps: after 6pm, below 40% of minimum goal */
export function checkSteps(ctx: CoachContext): CoachMessage | null {
  if (ctx.hourOfDay < 18) return null
  const goal = ctx.profile.stepsGoalMin
  const pct = ctx.stepsToday / goal
  if (pct >= 0.4) return null
  const remaining = Math.round(goal - ctx.stepsToday)
  return {
    id: 'low-steps',
    priority: 3,
    category: 'activity',
    title: 'Step count low',
    body: `You're ${remaining.toLocaleString()} steps short of your goal. A 15-minute walk adds ~1,500 steps.`,
    actionLabel: 'Log steps',
    actionPath: '/steps',
  }
}

/**
 * Deload signal: workouts this week >= goal AND avg sleep < 6h over last 3 days.
 * Suggests a lighter session or rest day.
 */
export function checkDeload(ctx: CoachContext): CoachMessage | null {
  const targetDays = ctx.profile.workoutDaysPerWeek ?? 4
  if (ctx.workoutsThisWeek < targetDays) return null
  if (ctx.sleepLast3Days.length < 2) return null
  const avgSleep = ctx.sleepLast3Days.reduce((a, b) => a + b, 0) / ctx.sleepLast3Days.length
  if (avgSleep >= 6.5) return null
  return {
    id: 'deload-signal',
    priority: 1,
    category: 'overload',
    title: 'Consider a deload',
    body: `You've trained ${ctx.workoutsThisWeek} days this week with only ${avgSleep.toFixed(1)} h average sleep. A lighter session or active recovery day may help more than pushing hard.`,
    actionLabel: 'View workouts',
    actionPath: '/workouts',
  }
}

/**
 * Weekly weight trend: compare average of last 7 days vs the 7 before that.
 * Returns a message only if there's a meaningful trend.
 */
export function checkWeightTrend(ctx: CoachContext): CoachMessage | null {
  const entries = ctx.weightLast7Days
  if (entries.length < 4) return null
  const recent = entries.slice(0, 4)
  const avgRecent = recent.reduce((a, b) => a + b.weightKg, 0) / recent.length

  const older = entries.slice(4)
  if (older.length < 2) return null
  const avgOlder = older.reduce((a, b) => a + b.weightKg, 0) / older.length

  const diff = avgRecent - avgOlder
  if (Math.abs(diff) < 0.3) return null  // less than 300g — not meaningful

  const trend = diff > 0 ? 'up' : 'down'
  const absDiff = Math.abs(diff).toFixed(1)

  const profileGoal = ctx.profile as { calorieTarget?: number }
  const onCut = profileGoal.calorieTarget !== undefined

  if (trend === 'down') {
    return {
      id: 'weight-trend-down',
      priority: 4,
      category: 'progress',
      title: `Weight trending down (−${absDiff} kg)`,
      body: onCut
        ? 'Good progress. Keep calories consistent and prioritize protein to protect muscle.'
        : 'Your weight is dropping. Make sure this aligns with your goal — increase calories if needed.',
      actionLabel: 'View progress',
      actionPath: '/progress',
    }
  }

  return {
    id: 'weight-trend-up',
    priority: 4,
    category: 'progress',
    title: `Weight trending up (+${absDiff} kg)`,
    body: 'Your 7-day average is rising. If you\'re on a cut, review your calorie intake for the past few days.',
    actionLabel: 'View progress',
    actionPath: '/progress',
  }
}

// ─── Adherence score ──────────────────────────────────────────────────────────

export function calculateAdherence(ctx: CoachContext): AdherenceScore {
  const targetWorkouts = ctx.profile.workoutDaysPerWeek ?? 4
  const workoutRatio = Math.min(1, ctx.workoutsThisWeek / targetWorkouts)
  const proteinRatio = ctx.proteinDaysThisWeek / 7
  const waterRatio = ctx.waterDaysThisWeek / 7
  const stepsRatio = ctx.stepsDaysThisWeek / 7
  const sleepRatio = ctx.sleepDaysThisWeek / 7

  // Weights: workouts 35%, protein 25%, water 20%, steps 10%, sleep 10%
  const overall = Math.round(
    (workoutRatio * 35 + proteinRatio * 25 + waterRatio * 20 + stepsRatio * 10 + sleepRatio * 10)
  )

  return {
    overall,
    workouts: Math.round(workoutRatio * 100),
    protein: Math.round(proteinRatio * 100),
    water: Math.round(waterRatio * 100),
    steps: Math.round(stepsRatio * 100),
    sleep: Math.round(sleepRatio * 100),
  }
}

/** Adherence message: shown if score is below 60 or above 85 */
export function checkAdherence(ctx: CoachContext): CoachMessage | null {
  const score = calculateAdherence(ctx)
  if (score.overall >= 85) {
    return {
      id: 'adherence-high',
      priority: 5,
      category: 'adherence',
      title: `Strong week — ${score.overall}% adherence`,
      body: 'You\'re hitting your targets consistently. Keep this up and results will follow.',
      actionPath: '/today',
    }
  }
  if (score.overall < 40) {
    return {
      id: 'adherence-low',
      priority: 3,
      category: 'adherence',
      title: `Tough week — ${score.overall}% adherence`,
      body: 'Focus on one habit first: water is the easiest win. Even small improvements compound.',
      actionLabel: 'Log water',
      actionPath: '/water',
    }
  }
  return null
}

// ─── Master evaluate ──────────────────────────────────────────────────────────

/** Run all rules against the context and return messages sorted by priority. */
export function evaluate(ctx: CoachContext): CoachMessage[] {
  const checks = [
    checkDeload(ctx),
    checkSleep(ctx),
    checkHydration(ctx),
    checkProtein(ctx),
    checkSteps(ctx),
    checkWeightTrend(ctx),
    checkAdherence(ctx),
  ]
  return checks
    .filter((m): m is CoachMessage => m !== null)
    .sort((a, b) => a.priority - b.priority)
}
