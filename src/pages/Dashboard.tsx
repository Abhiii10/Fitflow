import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '@/db/db'
import { useStore } from '@/store/useStore'
import { SyncStatusBadge } from '@/components/SyncStatusBadge'
import { ProgressRing } from '@/components/ProgressRing'
import { todayStr, dayName, calcStreak, currentDayOfWeek, formatDuration } from '@/utils/date'
import { format } from 'date-fns'
import { AIInsight } from '@/components/AIInsight'
import { formatRoutineTime, getRoutineEventsForDay, ROUTINE_COLOR_CLASSES } from '@/data/routineSchedule'
import { useWaterReminder } from '@/hooks/useWaterReminder'
import { useCoach } from '@/hooks/useCoach'

const MUSCLE_MAP: Record<string, string[]> = {
  'chest': ['chest', 'pec', 'bench', 'fly', 'push'],
  'back': ['back', 'row', 'pulldown', 'deadlift', 'lat', 'pull-up', 'chin'],
  'shoulders': ['shoulder', 'delt', 'press', 'lateral raise', 'face pull'],
  'biceps': ['bicep', 'curl', 'hammer'],
  'triceps': ['tricep', 'pushdown', 'extension', 'dip'],
  'legs': ['leg', 'squat', 'lunge', 'quad', 'hamstring', 'calf', 'rdl', 'leg press'],
  'abs': ['ab', 'core', 'crunch', 'plank'],
  'glutes': ['glute', 'hip thrust', 'kickback'],
}

function getMusclesWorked(exerciseNames: string[]): string[] {
  const worked = new Set<string>()
  for (const name of exerciseNames) {
    const lower = name.toLowerCase()
    for (const [muscle, keywords] of Object.entries(MUSCLE_MAP)) {
      if (keywords.some(k => lower.includes(k))) worked.add(muscle)
    }
  }
  return [...worked]
}

const CATEGORY_COLORS: Record<string, string> = {
  hydration: 'border-cyber-cyan/40 bg-cyber-cyan/5 text-cyber-cyan',
  nutrition: 'border-yellow-400/40 bg-yellow-400/5 text-yellow-400',
  recovery: 'border-red-400/40 bg-red-400/5 text-red-400',
  activity: 'border-cyber-green/40 bg-cyber-green/5 text-cyber-green',
  overload: 'border-orange-400/40 bg-orange-400/5 text-orange-400',
  progress: 'border-cyber-green/40 bg-cyber-green/5 text-cyber-green',
  adherence: 'border-cyber-cyan/40 bg-cyber-cyan/5 text-cyber-cyan',
}

export function Dashboard() {
  const { profile, activeSession } = useStore()
  const { result: coachResult } = useCoach()

  const today = todayStr()
  const dayOfWeek = currentDayOfWeek()

  const waterToday = useLiveQuery(
    () => db.waterLogs.where('date').equals(today).filter((l) => !l.deletedAt).toArray(),
    [today]
  )

  const todayPlans = useLiveQuery(
    () => db.workoutPlans.filter((p) => !p.deletedAt && p.daysOfWeek.includes(dayOfWeek)).toArray(),
    [dayOfWeek]
  )

  const routineItems = useLiveQuery(
    () => db.routineItems.filter((item) => !item.deletedAt).toArray(),
    []
  )

  const recentSessions = useLiveQuery(
    () => db.workoutSessions.orderBy('startedAt').reverse().filter((s) => !s.deletedAt && !!s.completedAt).limit(30).toArray(),
    []
  )

  const recentExerciseLogs = useLiveQuery(async () => {
    const cutoff = Date.now() - 48 * 3600 * 1000
    return db.sessionExerciseLogs.filter(l => l.completedAt > cutoff).toArray()
  }, [])

  const waterGoal = profile?.waterGoalMl ?? 3500
  const waterTotal = waterToday?.reduce((sum, l) => sum + l.amountMl, 0) ?? 0
  const waterPct = Math.min(100, (waterTotal / waterGoal) * 100)

  useWaterReminder(waterTotal, waterGoal)

  const recoveringMuscles = getMusclesWorked((recentExerciseLogs ?? []).map(l => l.exerciseName))
  const ALL_MUSCLES = Object.keys(MUSCLE_MAP)
  const readyMuscles = ALL_MUSCLES.filter(m => !recoveringMuscles.includes(m))

  const sessionDates = recentSessions?.map((s) => {
    const d = new Date(s.startedAt)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }) ?? []
  const streak = calcStreak(sessionDates)

  const lastSession = recentSessions?.[0]
  const routineEvents = getRoutineEventsForDay(routineItems, dayOfWeek)

  const topCoachMessage = coachResult?.messages[0]
  const adherence = coachResult?.adherence

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-mono font-bold text-cyber-green tracking-tight">FitFlow</h1>
          <p className="text-xs text-cyber-dim font-mono">{format(new Date(), 'EEEE, MMM d')}</p>
        </div>
        <SyncStatusBadge />
      </div>

      {/* Active Session Banner */}
      {activeSession && (
        <Link to="/session" className="block mb-4 p-3 rounded-lg border border-cyber-green/40 bg-cyber-green/5 shadow-glow-sm animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-cyber-green uppercase tracking-widest mb-1">Active Session</div>
              <div className="font-semibold text-cyber-text">{activeSession.planName}</div>
            </div>
            <div className="flex items-center gap-2 text-cyber-green font-mono text-sm">
              <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
              Resume
            </div>
          </div>
        </Link>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link to="/water" className="card group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-cyber-dim uppercase tracking-widest">Water</span>
            <span className="text-xs font-mono text-cyber-green">{Math.round(waterPct)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <ProgressRing value={waterPct} size={56} strokeWidth={5} color="#00ff87">
              <span className="text-[10px] font-mono text-cyber-green">
                {waterPct >= 100 ? '✓' : `${Math.round(waterPct)}%`}
              </span>
            </ProgressRing>
            <div>
              <div className="text-lg font-mono font-bold text-cyber-text">{waterTotal}</div>
              <div className="text-xs text-cyber-dim font-mono">/ {waterGoal} ml</div>
            </div>
          </div>
        </Link>

        <div className="card">
          <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-2">Streak</div>
          <div className="flex items-end gap-1">
            <span className="text-4xl font-mono font-bold text-cyber-cyan">{streak}</span>
            <span className="text-sm font-mono text-cyber-dim mb-1">days</span>
          </div>
          <div className="text-xs text-cyber-dim font-mono mt-1">
            {streak === 0 ? 'Start today!' : streak === 1 ? 'Keep it up!' : `${streak} days strong`}
          </div>
        </div>
      </div>

      {/* Coach Message */}
      {topCoachMessage && (
        <div className={`mb-4 rounded-xl border p-3 ${CATEGORY_COLORS[topCoachMessage.category] ?? 'border-cyber-border'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="text-[10px] font-mono uppercase tracking-widest opacity-70 mb-1">
                Coach · {topCoachMessage.category}
              </div>
              <div className="text-sm font-semibold text-cyber-text mb-0.5">{topCoachMessage.title}</div>
              <div className="text-xs text-cyber-dim leading-relaxed">{topCoachMessage.body}</div>
            </div>
          </div>
          {topCoachMessage.actionLabel && topCoachMessage.actionPath && (
            <Link
              to={topCoachMessage.actionPath}
              className="mt-2 inline-block text-xs font-mono underline underline-offset-2 opacity-80 hover:opacity-100"
            >
              {topCoachMessage.actionLabel} →
            </Link>
          )}
        </div>
      )}

      {/* Weekly Adherence */}
      {adherence && (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-cyber-dim uppercase tracking-widest">Weekly Adherence</span>
            <span className={`text-sm font-mono font-bold ${adherence.overall >= 80 ? 'text-cyber-green' : adherence.overall >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {adherence.overall}%
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {[
              { label: 'Work', value: adherence.workouts },
              { label: 'Prot', value: adherence.protein },
              { label: 'Water', value: adherence.water },
              { label: 'Steps', value: adherence.steps },
              { label: 'Sleep', value: adherence.sleep },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1">
                <div className="w-full h-1.5 rounded-full bg-cyber-border overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${item.value >= 80 ? 'bg-cyber-green' : item.value >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-cyber-dim">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insight */}
      <AIInsight />

      {/* Routine */}
      <div className="mb-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title mb-0">Routine</h2>
          <Link to="/calendar" className="text-xs font-mono text-cyber-green hover:underline">Routines</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {routineEvents.length > 0 ? (
            routineEvents.map((event) => (
              <Link key={event.id} to="/calendar" className={`rounded-xl border p-3 ${ROUTINE_COLOR_CLASSES[event.color]}`}>
                <div className="text-[11px] font-mono uppercase tracking-widest opacity-80">{formatRoutineTime(event.time)}</div>
                <div className="mt-1 text-base font-bold text-cyber-text">{event.title}</div>
                <div className="mt-1 text-xs text-cyber-dim">Popup reminder</div>
              </Link>
            ))
          ) : (
            <Link to="/calendar" className="col-span-2 card text-center text-sm text-cyber-dim">
              Rest day. View routines.
            </Link>
          )}
        </div>
      </div>

      {/* Today's Workouts */}
      <div className="mb-4">
        <h2 className="section-title">Today's Plans</h2>
        {todayPlans && todayPlans.length > 0 ? (
          <div className="space-y-2">
            {todayPlans.map((plan) => (
              <Link key={plan.id} to={`/workouts/${plan.id}`} className="card flex items-center justify-between group">
                <div>
                  <div className="font-semibold text-cyber-text group-hover:text-cyber-green transition-colors">{plan.name}</div>
                  {plan.description && <div className="text-xs text-cyber-dim mt-0.5">{plan.description}</div>}
                  <div className="flex gap-1 mt-1">
                    {plan.daysOfWeek.map((d) => (
                      <span key={d} className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${d === dayOfWeek ? 'border-cyber-green text-cyber-green bg-cyber-green/10' : 'border-cyber-border text-cyber-dim'}`}>
                        {dayName(d)}
                      </span>
                    ))}
                  </div>
                </div>
                <svg className="w-5 h-5 text-cyber-dim group-hover:text-cyber-green transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card text-center py-6">
            <div className="text-cyber-dim font-mono text-sm">No workouts planned for today</div>
            <Link to="/workouts" className="mt-3 inline-block text-cyber-green font-mono text-sm hover:underline">Browse all plans →</Link>
          </div>
        )}
      </div>

      {/* Last Session */}
      {lastSession && (
        <div>
          <h2 className="section-title">Last Session</h2>
          <div className="card">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-cyber-text">{lastSession.planName}</div>
                <div className="text-xs font-mono text-cyber-dim mt-1">{format(new Date(lastSession.startedAt), 'MMM d, h:mm a')}</div>
              </div>
              {lastSession.durationSeconds && (
                <span className="text-xs font-mono text-cyber-cyan border border-cyber-cyan/30 px-2 py-1 rounded">
                  {formatDuration(lastSession.durationSeconds)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recovery Status */}
      <div className="mb-4">
        <h2 className="section-title">Recovery Status</h2>
        <div className="card">
          {recoveringMuscles.length === 0 ? (
            <p className="text-sm text-cyber-green font-mono">All muscles recovered. Ready to train!</p>
          ) : (
            <>
              <div className="mb-2">
                <div className="text-[10px] font-mono text-yellow-400 uppercase tracking-widest mb-1.5">Still Recovering (48h)</div>
                <div className="flex flex-wrap gap-1.5">
                  {recoveringMuscles.map(m => (
                    <span key={m} className="text-xs font-mono px-2 py-0.5 rounded-full border border-yellow-400/30 text-yellow-400 bg-yellow-400/5 capitalize">{m}</span>
                  ))}
                </div>
              </div>
              {readyMuscles.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono text-cyber-green uppercase tracking-widest mb-1.5">Ready to Train</div>
                  <div className="flex flex-wrap gap-1.5">
                    {readyMuscles.map(m => (
                      <span key={m} className="text-xs font-mono px-2 py-0.5 rounded-full border border-cyber-green/30 text-cyber-green bg-cyber-green/5 capitalize">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4">
        <h2 className="section-title">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/water" className="card flex items-center gap-3 hover:border-cyber-cyan/40 transition-colors group">
            <div className="w-8 h-8 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/30 flex items-center justify-center text-cyber-cyan">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4.97 5.21-6 8.22-6 10a6 6 0 0012 0c0-1.78-1.03-4.79-6-10z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-cyber-text group-hover:text-cyber-cyan transition-colors">Log Water</span>
          </Link>
          <Link to="/workouts" className="card flex items-center gap-3 hover:border-cyber-green/40 transition-colors group">
            <div className="w-8 h-8 rounded-lg bg-cyber-green/10 border border-cyber-green/30 flex items-center justify-center text-cyber-green">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-cyber-text group-hover:text-cyber-green transition-colors">Start Workout</span>
          </Link>
          <Link to="/checkin" className="card flex items-center gap-3 hover:border-cyber-cyan/40 transition-colors group">
            <div className="w-8 h-8 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/30 flex items-center justify-center text-cyber-cyan">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-cyber-text group-hover:text-cyber-cyan transition-colors">Weekly Check-in</span>
          </Link>
          <Link to="/ai" className="card flex items-center gap-3 hover:border-yellow-400/40 transition-colors group">
            <div className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-cyber-text group-hover:text-yellow-400 transition-colors">AI Coach</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
