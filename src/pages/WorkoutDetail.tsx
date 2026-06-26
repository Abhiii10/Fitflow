import { useLiveQuery } from 'dexie-react-hooks'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { db, saveActiveSession } from '@/db/db'
import { useStore } from '@/store/useStore'
import { ExerciseCard } from '@/components/ExerciseCard'
import { generateId } from '@/utils/id'
import { dayName } from '@/utils/date'
import type { ActiveSession, Exercise } from '@/types'

export function WorkoutDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setActiveSession } = useStore()

  const plan = useLiveQuery(() => (id ? db.workoutPlans.get(id) : undefined), [id])
  const exercises = useLiveQuery<Exercise[]>(
    () =>
      id
        ? db.exercises
            .where('planId')
            .equals(id)
            .filter((e) => !e.deletedAt)
            .sortBy('order')
        : Promise.resolve([] as Exercise[]),
    [id]
  )

  async function startSession() {
    if (!plan || !exercises || exercises.length === 0) return

    const sessionId = generateId()
    const now = Date.now()
    const session: ActiveSession = {
      sessionId,
      planId: plan.id,
      planName: plan.name,
      exercises,
      currentExerciseIndex: 0,
      currentSet: 1,
      phase: 'exercise',
      phaseEndTime: exercises[0]?.durationSeconds
        ? now + exercises[0].durationSeconds * 1000
        : null,
      startedAt: now,
      logs: [],
    }

    await db.workoutSessions.add({
      id: sessionId,
      planId: plan.id,
      planName: plan.name,
      startedAt: now,
      updatedAt: now,
      pendingSync: true,
      syncStatus: 'pending',
    })

    await saveActiveSession(session)
    setActiveSession(session)
    navigate('/session')
  }

  async function deletePlan() {
    if (!id) return
    const confirmed = confirm('Delete this workout plan?')
    if (!confirmed) return
    const now = Date.now()
    await db.workoutPlans.update(id, { deletedAt: now, updatedAt: now, pendingSync: true, syncStatus: 'pending' })
    await db.exercises
      .where('planId')
      .equals(id)
      .modify({ deletedAt: now, updatedAt: now, pendingSync: true, syncStatus: 'pending' })
    navigate('/workouts')
  }

  if (!plan) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="text-cyber-dim font-mono">Loading...</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => navigate('/workouts')}
          className="p-1 text-cyber-dim hover:text-cyber-text transition-colors"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="page-title flex-1">{plan.name}</h1>
        <Link
          to={`/workouts/${id}/edit`}
          className="p-1.5 text-cyber-dim hover:text-cyber-cyan transition-colors"
          aria-label="Edit"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </Link>
        <button
          onClick={deletePlan}
          className="p-1.5 text-cyber-dim hover:text-cyber-red transition-colors"
          aria-label="Delete"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {plan.description && (
        <p className="text-cyber-dim text-sm mb-3 ml-8">{plan.description}</p>
      )}

      <div className="flex gap-1 mb-5 ml-8">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <span
            key={d}
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              plan.daysOfWeek.includes(d)
                ? 'border-cyber-cyan/50 text-cyber-cyan bg-cyber-cyan/5'
                : 'border-cyber-border text-cyber-muted'
            }`}
          >
            {dayName(d)}
          </span>
        ))}
      </div>

      {/* Exercises */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title mb-0">Exercises ({exercises?.length ?? 0})</h2>
          <Link
            to={`/workouts/${id}/edit`}
            className="text-xs font-mono text-cyber-cyan hover:text-cyber-text transition-colors"
          >
            + Add Exercise
          </Link>
        </div>

        {exercises && exercises.length > 0 ? (
          <div className="space-y-2">
            {exercises.map((ex, i) => (
              <ExerciseCard key={ex.id} exercise={ex} index={i} />
            ))}
          </div>
        ) : (
          <div className="card text-center py-6 text-cyber-dim text-sm font-mono">
            No exercises yet.{' '}
            <Link to={`/workouts/${id}/edit`} className="text-cyber-cyan hover:underline">
              Add some
            </Link>
          </div>
        )}
      </div>

      {/* Start Button */}
      <button
        onClick={startSession}
        disabled={!exercises || exercises.length === 0}
        className="w-full py-4 rounded-xl bg-cyber-green text-cyber-black font-mono font-bold text-base tracking-wide hover:bg-cyber-green/90 transition-all active:scale-95 shadow-glow-green disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
      >
        START WORKOUT
      </button>
    </div>
  )
}
