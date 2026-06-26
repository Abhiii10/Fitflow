import { db } from '@/db/db'
import { todayStr, formatDuration } from '@/utils/date'

export async function buildFitnessContext(): Promise<string> {
  const today = todayStr()

  const [recentSessions, waterToday, proteinToday, stepsToday, sleepToday, plans, profile] = await Promise.all([
    db.workoutSessions
      .orderBy('startedAt')
      .reverse()
      .filter((s) => !s.deletedAt && !!s.completedAt)
      .limit(10)
      .toArray(),
    db.waterLogs.where('date').equals(today).filter((l) => !l.deletedAt).toArray(),
    db.proteinLogs.where('date').equals(today).filter((l) => !l.deletedAt).toArray(),
    db.stepLogs.where('date').equals(today).toArray().catch(() => []),
    db.sleepLogs.where('date').equals(today).toArray().catch(() => []),
    db.workoutPlans.filter((p) => !p.deletedAt).toArray(),
    db.profile.get('default'),
  ])

  const waterTodayTotal = waterToday.reduce((s, l) => s + l.amountMl, 0)
  const proteinTodayTotal = proteinToday.reduce((s, l) => s + l.amountG, 0)
  const stepsTodayTotal = stepsToday.reduce((s, l) => s + (l.steps ?? 0), 0)
  const sleepLast = sleepToday[0]
  const waterGoal = profile?.waterGoalMl ?? 3500
  const proteinGoal = `${profile?.proteinGoalMinG ?? 140}–${profile?.proteinGoalMaxG ?? 160}g`
  const stepsGoal = `${profile?.stepsGoalMin ?? 8000}–${profile?.stepsGoalMax ?? 12000}`

  const sessionSummaries = recentSessions
    .slice(0, 7)
    .map((s) => {
      const d = new Date(s.startedAt)
      return `- ${s.planName} on ${d.toDateString()}${s.durationSeconds ? ` (${formatDuration(s.durationSeconds)})` : ''}`
    })
    .join('\n')

  const planNames = plans.map((p) => p.name).join(', ')

  // Calculate streak
  const sessionDates = recentSessions.map((s) => {
    const d = new Date(s.startedAt)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const uniqueDays = [...new Set(sessionDates)].sort().reverse()
  let streak = 0
  const now = new Date()
  for (let i = 0; i < uniqueDays.length; i++) {
    const expected = new Date(now)
    expected.setDate(expected.getDate() - i)
    const expectedStr = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`
    if (uniqueDays[i] === expectedStr) streak++
    else break
  }

  return `
Today: ${new Date().toDateString()}
Workout streak: ${streak} days

TODAY'S PROGRESS:
- Water: ${waterTodayTotal}ml / ${waterGoal}ml (${Math.round((waterTodayTotal / waterGoal) * 100)}%)
- Protein: ${proteinTodayTotal}g / ${proteinGoal} goal
- Steps: ${stepsTodayTotal > 0 ? `${stepsTodayTotal} / ${stepsGoal}` : 'not logged yet'}
- Sleep last night: ${sleepLast ? `${sleepLast.hoursSlept}h${sleepLast.quality ? ` (quality ${sleepLast.quality}/5)` : ''}` : 'not logged'}

WORKOUT PLANS (${plans.length}): ${planNames || 'none'}
RECENT SESSIONS (last 7):
${sessionSummaries || '- No recent sessions'}
Total sessions logged: ${recentSessions.length}
`.trim()
}
