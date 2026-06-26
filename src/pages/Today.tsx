import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '@/db/db'
import { useStore } from '@/store/useStore'
import { ProgressRing } from '@/components/ProgressRing'
import { todayStr, currentDayOfWeek, dayName } from '@/utils/date'
import { format } from 'date-fns'
import type { WorkoutPlan } from '@/types'
import { formatRoutineTime, getRoutineEventsForDay, ROUTINE_COLOR_CLASSES } from '@/data/routineSchedule'

const DAY_TYPE_COLORS: Record<string, string> = {
  heavy: 'text-red-400 border-red-400/40 bg-red-400/5',
  light: 'text-cyber-cyan border-cyber-cyan/40 bg-cyber-cyan/5',
  'active-recovery': 'text-yellow-400 border-yellow-400/40 bg-yellow-400/5',
  rest: 'text-cyber-dim border-cyber-border',
}

const DAY_TYPE_LABELS: Record<string, string> = {
  heavy: 'Heavy Day',
  light: 'Light Day',
  'active-recovery': 'Active Recovery',
  rest: 'Rest Day',
}

export function Today() {
  const { profile } = useStore()
  const today = todayStr()
  const dayOfWeek = currentDayOfWeek()

  const waterToday = useLiveQuery(
    () => db.waterLogs.where('date').equals(today).filter(l => !l.deletedAt).toArray(),
    [today]
  )

  const proteinToday = useLiveQuery(
    () => db.proteinLogs.where('date').equals(today).filter(l => !l.deletedAt).toArray(),
    [today]
  )

  const stepsToday = useLiveQuery(
    () => db.stepLogs.where('date').equals(today).first(),
    [today]
  )

  const sleepToday = useLiveQuery(
    () => db.sleepLogs.where('date').equals(today).first(),
    [today]
  )

  const todayPlan = useLiveQuery(
    () => db.workoutPlans.filter(p => !p.deletedAt && p.daysOfWeek.includes(dayOfWeek)).first(),
    [dayOfWeek]
  )

  const todaySession = useLiveQuery(
    async () => {
      if (!todayPlan) return null
      const all = await db.workoutSessions
        .filter(s => s.planId === todayPlan.id && !s.deletedAt)
        .toArray()
      const todayDate = today
      return all.find(s => {
        const d = new Date(s.startedAt)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayDate
      }) ?? null
    },
    [todayPlan, today]
  )

  const waterGoal = profile?.waterGoalMl ?? 3500
  const proteinGoalMin = profile?.proteinGoalMinG ?? 140
  const proteinGoalMax = profile?.proteinGoalMaxG ?? 160
  const stepsGoalMin = profile?.stepsGoalMin ?? 8000
  const stepsGoalMax = profile?.stepsGoalMax ?? 12000
  const sleepGoalMin = profile?.sleepGoalMinH ?? 7

  const waterTotal = waterToday?.reduce((s, l) => s + l.amountMl, 0) ?? 0
  const proteinTotal = proteinToday?.reduce((s, l) => s + l.amountG, 0) ?? 0
  const steps = stepsToday?.steps ?? 0
  const hoursSlept = sleepToday?.hoursSlept ?? 0

  const waterPct = Math.min(100, (waterTotal / waterGoal) * 100)
  const proteinPct = Math.min(100, (proteinTotal / proteinGoalMax) * 100)
  const stepsPct = Math.min(100, (steps / stepsGoalMax) * 100)
  const sleepPct = Math.min(100, (hoursSlept / sleepGoalMin) * 100)

  return (
    <div className="page-container">
      <div className="mb-5">
        <h1 className="text-xl font-mono font-bold text-cyber-green tracking-tight">Today</h1>
        <p className="text-xs text-cyber-dim font-mono">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Today's Plan */}
      {todayPlan && (
        <div className={`mb-4 p-3 rounded-lg border ${DAY_TYPE_COLORS[todayPlan.dayType ?? 'heavy']}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono uppercase tracking-widest opacity-70">
              {DAY_TYPE_LABELS[todayPlan.dayType ?? 'heavy']}
            </span>
            {todaySession?.completedAt && (
              <span className="text-xs font-mono text-cyber-green">DONE</span>
            )}
          </div>
          <div className="font-semibold text-cyber-text">{todayPlan.name}</div>
          {todayPlan.cardioTarget && (
            <div className="text-xs text-cyber-dim mt-1">{todayPlan.cardioTarget}</div>
          )}
          {!todaySession?.completedAt && (
            <Link
              to={`/workouts/${todayPlan.id}`}
              className="inline-block mt-2 text-xs font-mono text-cyber-green hover:underline"
            >
              Start workout →
            </Link>
          )}
        </div>
      )}

      {/* Daily Targets Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link to="/water" className="card group">
          <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-2">Water</div>
          <div className="flex items-center gap-3">
            <ProgressRing value={waterPct} size={48} strokeWidth={4} color="#00ff87">
              <span className="text-[9px] font-mono text-cyber-green">{Math.round(waterPct)}%</span>
            </ProgressRing>
            <div>
              <div className="text-base font-mono font-bold text-cyber-text">{waterTotal}</div>
              <div className="text-[11px] text-cyber-dim font-mono">/ {waterGoal}ml</div>
            </div>
          </div>
        </Link>

        <Link to="/nutrition" className="card group">
          <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-2">Protein</div>
          <div className="flex items-center gap-3">
            <ProgressRing value={proteinPct} size={48} strokeWidth={4} color="#60a5fa">
              <span className="text-[9px] font-mono text-blue-400">{Math.round(proteinPct)}%</span>
            </ProgressRing>
            <div>
              <div className="text-base font-mono font-bold text-cyber-text">{proteinTotal}g</div>
              <div className="text-[11px] text-cyber-dim font-mono">{proteinGoalMin}–{proteinGoalMax}g goal</div>
            </div>
          </div>
        </Link>

        <Link to="/steps" className="card group">
          <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-2">Steps</div>
          <div className="flex items-center gap-3">
            <ProgressRing value={stepsPct} size={48} strokeWidth={4} color="#a78bfa">
              <span className="text-[9px] font-mono text-purple-400">{Math.round(stepsPct)}%</span>
            </ProgressRing>
            <div>
              <div className="text-base font-mono font-bold text-cyber-text">{steps.toLocaleString()}</div>
              <div className="text-[11px] text-cyber-dim font-mono">{stepsGoalMin.toLocaleString()}–{stepsGoalMax.toLocaleString()}</div>
            </div>
          </div>
        </Link>

        <Link to="/steps" className="card group">
          <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-2">Sleep</div>
          <div className="flex items-center gap-3">
            <ProgressRing value={sleepPct} size={48} strokeWidth={4} color="#fb923c">
              <span className="text-[9px] font-mono text-orange-400">{Math.round(sleepPct)}%</span>
            </ProgressRing>
            <div>
              <div className="text-base font-mono font-bold text-cyber-text">{hoursSlept > 0 ? `${hoursSlept}h` : '—'}</div>
              <div className="text-[11px] text-cyber-dim font-mono">Goal: {sleepGoalMin}–{profile?.sleepGoalMaxH ?? 9}h</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Today's schedule */}
      <div>
        <h2 className="section-title">Week at a Glance</h2>
        <WeekSchedule activeDayOfWeek={dayOfWeek} />
      </div>
    </div>
  )
}

function WeekSchedule({ activeDayOfWeek }: { activeDayOfWeek: number }) {
  const plans = useLiveQuery(() => db.workoutPlans.filter(p => !p.deletedAt).toArray(), [])

  const dayMap: Record<number, WorkoutPlan | undefined> = {}
  if (plans) {
    for (const plan of plans) {
      for (const d of plan.daysOfWeek) {
        dayMap[d] = plan
      }
    }
  }

  const routineItems = useLiveQuery(() => db.routineItems.filter(item => !item.deletedAt).toArray(), [])

  const days = [0, 1, 2, 3, 4, 5, 6]

  return (
    <div className="space-y-1">
      {days.map(d => {
        const plan = dayMap[d]
        const isToday = d === activeDayOfWeek
        const dayTypeColor = plan?.dayType ? DAY_TYPE_COLORS[plan.dayType] : ''
        const routineEvents = getRoutineEventsForDay(routineItems, d)
        return (
          <div key={d} className={`flex items-start gap-3 p-2 rounded-lg border transition-colors ${isToday ? 'border-cyber-green/30 bg-cyber-green/5' : 'border-transparent'}`}>
            <span className={`w-6 text-[11px] font-mono ${isToday ? 'text-cyber-green font-bold' : 'text-cyber-dim'}`}>
              {dayName(d).slice(0, 3)}
            </span>
            <div className="flex-1">
              {plan ? (
                <Link to={`/workouts/${plan.id}`} className="flex items-center justify-between group">
                  <span className={`text-sm font-medium ${isToday ? 'text-cyber-text' : 'text-cyber-dim'} group-hover:text-cyber-green transition-colors`}>
                    {plan.name}
                  </span>
                  {plan.dayType && (
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${dayTypeColor}`}>
                      {plan.dayType}
                    </span>
                  )}
                </Link>
              ) : (
                <span className="text-sm text-cyber-dim/50 font-mono">Rest</span>
              )}
              {routineEvents.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {routineEvents.map((event) => (
                    <span key={event.id} className={`rounded border px-1.5 py-0.5 text-[9px] font-mono ${ROUTINE_COLOR_CLASSES[event.color]}`}>
                      {formatRoutineTime(event.time)} {event.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
