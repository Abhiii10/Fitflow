import { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { useTimer } from '@/hooks/useTimer'
import { db, saveActiveSession, clearActiveSession } from '@/db/db'
import { TimerRing } from '@/components/TimerRing'
import { generateId } from '@/utils/id'
import { formatDuration } from '@/utils/date'
import type { ActiveSession, SessionExerciseLog } from '@/types'

function beep(profile: { timerSoundEnabled: boolean } | null) {
  if (!profile?.timerSoundEnabled) return
  const audio = new Audio('/beep.mp3')
  audio.volume = 0.5
  audio.play().catch(() => {})
}

function vibrate(profile: { vibrationEnabled: boolean } | null) {
  if (!profile?.vibrationEnabled) return
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
}

export function ActiveSession() {
  const navigate = useNavigate()
  const { activeSession, setActiveSession, profile } = useStore()

  const [showWeightInput, setShowWeightInput] = useState(false)
  const [inputWeight, setInputWeight] = useState('')
  const [inputReps, setInputReps] = useState('')
  const [prBanner, setPrBanner] = useState<string | null>(null)
  const [prevPerf, setPrevPerf] = useState<{ weightKg: number; reps?: number } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [showSwap, setShowSwap] = useState(false)
  const [planExercises, setPlanExercises] = useState<import('@/types').Exercise[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      if (activeSession) setElapsed(Math.floor((Date.now() - activeSession.startedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeSession?.startedAt])

  const currentExercise = activeSession?.exercises[activeSession.currentExerciseIndex ?? 0]
  const isRestPhase = activeSession?.phase === 'rest'
  const isComplete = activeSession?.phase === 'complete'

  const onTimerComplete = useCallback(() => {
    if (!activeSession) return
    beep(profile)
    vibrate(profile)

    if (isRestPhase) {
      // Rest done → next set or next exercise
      advanceExercise(activeSession)
    } else if (currentExercise?.durationSeconds) {
      // Timed exercise done → go to rest
      startRest(activeSession)
    }
  }, [activeSession, isRestPhase, currentExercise, profile])

  const { remaining, start, startAt, stop } = useTimer({ onComplete: onTimerComplete })

  // Restore timer on mount
  useEffect(() => {
    if (!activeSession?.phaseEndTime) return
    const rem = Math.ceil((activeSession.phaseEndTime - Date.now()) / 1000)
    if (rem > 0) {
      startAt(activeSession.phaseEndTime)
    }
  }, []) // intentional — only on mount

  useEffect(() => {
    if (!currentExercise || !activeSession) { setPrevPerf(null); return }
    db.sessionExerciseLogs
      .filter(l => l.exerciseName === currentExercise.name && l.sessionId !== activeSession.sessionId && !!l.weightKg)
      .sortBy('completedAt')
      .then(logs => {
        const last = logs[logs.length - 1]
        setPrevPerf(last ? { weightKg: last.weightKg!, reps: last.repsCompleted } : null)
      })
  }, [activeSession?.currentExerciseIndex, activeSession?.sessionId])

  function updateSession(updates: Partial<ActiveSession>) {
    if (!activeSession) return
    const next = { ...activeSession, ...updates }
    setActiveSession(next)
    saveActiveSession(next)
  }

  async function logSet(weightKg?: number, repsCompleted?: number) {
    if (!activeSession || !currentExercise) return
    const now = Date.now()
    const log: SessionExerciseLog = {
      id: generateId(),
      sessionId: activeSession.sessionId,
      exerciseId: currentExercise.id,
      exerciseName: currentExercise.name,
      setNumber: activeSession.currentSet,
      repsCompleted: repsCompleted ?? currentExercise.reps,
      weightKg,
      durationSeconds: currentExercise.durationSeconds,
      completedAt: now,
      updatedAt: now,
      pendingSync: true,
      syncStatus: 'pending',
    }
    await db.sessionExerciseLogs.add(log)
    const newLogs = [...activeSession.logs, log]
    updateSession({ logs: newLogs })
  }

  function openWeightInput() {
    if (!activeSession || !currentExercise) return
    const lastSet = [...activeSession.logs].reverse().find(l => l.exerciseName === currentExercise.name)
    setInputWeight(lastSet?.weightKg ? String(lastSet.weightKg) : '')
    setInputReps(currentExercise.reps ? String(currentExercise.reps) : '')
    setShowWeightInput(true)
  }

  async function confirmSet() {
    if (!activeSession || !currentExercise) return
    const weightKg = inputWeight ? parseFloat(inputWeight) : undefined
    const repsCompleted = inputReps ? parseInt(inputReps) : currentExercise.reps

    if (weightKg) {
      const allLogs = await db.sessionExerciseLogs
        .filter(l => l.exerciseName === currentExercise.name && !!l.weightKg)
        .toArray()
      const prevMax = allLogs.length > 0 ? Math.max(...allLogs.map(l => l.weightKg!)) : 0
      if (weightKg > prevMax) {
        setPrBanner(currentExercise.name)
        setTimeout(() => setPrBanner(null), 3500)
      }
    }

    await logSet(weightKg, repsCompleted)
    setShowWeightInput(false)
    beep(profile)
    vibrate(profile)
    startRest(activeSession)
  }

  function startRest(session: ActiveSession) {
    const ex = session.exercises[session.currentExerciseIndex]
    if (!ex) return
    const restSecs = ex.restSeconds ?? profile?.defaultRestSeconds ?? 90
    const endTime = Date.now() + restSecs * 1000
    start(restSecs)
    updateSession({ phase: 'rest', phaseEndTime: endTime })
  }

  function advanceExercise(session: ActiveSession) {
    const { currentExerciseIndex, currentSet, exercises } = session
    const ex = exercises[currentExerciseIndex]
    if (!ex) return

    if (currentSet < ex.sets) {
      // Next set of same exercise
      let nextEndTime: number | null = null
      if (ex.durationSeconds) {
        nextEndTime = Date.now() + ex.durationSeconds * 1000
        start(ex.durationSeconds)
      } else {
        stop()
      }
      const next = { ...session, currentSet: currentSet + 1, phase: 'exercise' as const, phaseEndTime: nextEndTime }
      updateSession(next)
    } else if (currentExerciseIndex < exercises.length - 1) {
      // Next exercise
      const nextIdx = currentExerciseIndex + 1
      const nextEx = exercises[nextIdx]
      if (!nextEx) return
      const next: Partial<ActiveSession> = {
        currentExerciseIndex: nextIdx,
        currentSet: 1,
        phase: 'exercise',
        phaseEndTime: null,
      }
      if (nextEx.durationSeconds) {
        const endTime = Date.now() + nextEx.durationSeconds * 1000
        next.phaseEndTime = endTime
        start(nextEx.durationSeconds)
      } else {
        stop()
      }
      updateSession(next)
    } else {
      // Done!
      stop()
      updateSession({ phase: 'complete', phaseEndTime: null })
    }
  }

  async function handleCompleteSet() {
    if (!activeSession || !currentExercise) return
    if (currentExercise.durationSeconds) {
      await logSet()
      beep(profile)
      vibrate(profile)
      startRest(activeSession)
    } else {
      openWeightInput()
    }
  }

  function handleSkipRest() {
    if (!activeSession) return
    stop()
    advanceExercise({ ...activeSession, phase: 'rest' })
  }

  function handleSkipExercise() {
    if (!activeSession) return
    stop()
    advanceExercise({ ...activeSession, currentSet: activeSession.exercises[activeSession.currentExerciseIndex]?.sets ?? 1 })
  }

  function handlePrevious() {
    if (!activeSession || activeSession.currentExerciseIndex === 0) return
    stop()
    const prevIdx = activeSession.currentExerciseIndex - 1
    const prevEx = activeSession.exercises[prevIdx]
    if (!prevEx) return
    updateSession({
      currentExerciseIndex: prevIdx,
      currentSet: 1,
      phase: 'exercise',
      phaseEndTime: null,
    })
  }

  async function openSwap() {
    if (!activeSession) return
    const exs = await db.exercises
      .where('planId').equals(activeSession.planId)
      .filter(e => !e.deletedAt)
      .sortBy('order')
    setPlanExercises(exs)
    setShowSwap(true)
  }

  function swapExercise(ex: import('@/types').Exercise) {
    if (!activeSession) return
    const newExercises = [...activeSession.exercises]
    newExercises[activeSession.currentExerciseIndex] = ex
    updateSession({ exercises: newExercises })
    setShowSwap(false)
  }

  async function finishSession() {
    if (!activeSession) return
    const now = Date.now()
    const durationSeconds = Math.round((now - activeSession.startedAt) / 1000)
    await db.workoutSessions.update(activeSession.sessionId, {
      completedAt: now,
      durationSeconds,
      updatedAt: now,
      pendingSync: true,
      syncStatus: 'pending',
    })
    await clearActiveSession()
    setActiveSession(null)
    navigate('/')
  }

  if (!activeSession) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-cyber-dim font-mono">No active session</p>
        <button onClick={() => navigate('/workouts')} className="btn-primary">
          Go to Workouts
        </button>
      </div>
    )
  }

  if (isComplete) {
    const totalSets = activeSession.logs.length
    const duration = Math.round((Date.now() - activeSession.startedAt) / 1000)
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[80vh] gap-6 text-center">
        <div className="text-6xl mb-2">🎉</div>
        <h1 className="text-2xl font-mono font-bold text-cyber-green">Workout Complete!</h1>
        <div className="card w-full max-w-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-3xl font-mono font-bold text-cyber-cyan">{totalSets}</div>
              <div className="text-xs font-mono text-cyber-dim mt-1">Sets logged</div>
            </div>
            <div>
              <div className="text-3xl font-mono font-bold text-cyber-text">{formatDuration(duration)}</div>
              <div className="text-xs font-mono text-cyber-dim mt-1">Duration</div>
            </div>
          </div>
        </div>
        <button onClick={finishSession} className="w-full max-w-sm py-4 rounded-xl bg-cyber-green text-cyber-black font-mono font-bold text-base shadow-glow-green">
          FINISH & SAVE
        </button>
      </div>
    )
  }

  const exerciseCount = activeSession.exercises.length
  const overallProgress = ((activeSession.currentExerciseIndex / exerciseCount) * 100)

  return (
    <div className="page-container flex flex-col">
      {/* PR Banner */}
      {prBanner && (
        <div className="fixed top-4 inset-x-4 z-50 flex items-center gap-3 rounded-xl border border-yellow-400/60 bg-cyber-black/95 px-4 py-3 shadow-lg animate-slide-up">
          <span className="text-2xl">🏆</span>
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-yellow-400">New Personal Record!</div>
            <div className="font-bold text-cyber-text">{prBanner}</div>
          </div>
        </div>
      )}

      {/* Weight Input Modal */}
      {showWeightInput && currentExercise && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setShowWeightInput(false)}>
          <div className="w-full rounded-t-2xl border-t border-cyber-border bg-cyber-black p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="mb-1 font-mono text-xs uppercase tracking-widest text-cyber-cyan">Log Set {activeSession.currentSet}</div>
            <div className="mb-4 text-base font-bold text-cyber-text">{currentExercise.name}</div>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-xs text-cyber-dim">Weight (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 40"
                  value={inputWeight}
                  onChange={e => setInputWeight(e.target.value)}
                  className="input-field text-center text-lg font-mono font-bold"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-cyber-dim">Reps</label>
                <input
                  type="number"
                  placeholder={currentExercise.reps ? String(currentExercise.reps) : 'e.g. 10'}
                  value={inputReps}
                  onChange={e => setInputReps(e.target.value)}
                  className="input-field text-center text-lg font-mono font-bold"
                />
              </div>
            </div>
            <button onClick={confirmSet} className="btn-primary w-full mb-2">
              Log Set &amp; Start Rest
            </button>
            <button
              onClick={async () => {
                await logSet(undefined, inputReps ? parseInt(inputReps) : undefined)
                setShowWeightInput(false)
                beep(profile)
                vibrate(profile)
                startRest(activeSession)
              }}
              className="btn-secondary w-full text-cyber-dim"
            >
              Skip Weight
            </button>
          </div>
        </div>
      )}

      {/* Swap Modal */}
      {showSwap && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setShowSwap(false)}>
          <div className="w-full max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-cyber-border bg-cyber-black p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="mb-4 font-mono text-xs uppercase tracking-widest text-cyber-cyan">Swap Exercise</div>
            {planExercises.length === 0 ? (
              <p className="text-cyber-dim text-sm font-mono">No other exercises in this plan.</p>
            ) : (
              <div className="space-y-2">
                {planExercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => swapExercise(ex)}
                    className="w-full text-left card hover:border-cyber-cyan/40 transition-colors"
                  >
                    <div className="font-medium text-cyber-text">{ex.name}</div>
                    <div className="text-xs font-mono text-cyber-dim mt-0.5">
                      {ex.sets} sets · {ex.reps ? `${ex.reps} reps` : ex.durationSeconds ? `${ex.durationSeconds}s` : ''} · rest {ex.restSeconds}s
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest">{activeSession.planName}</div>
          <div className="text-sm font-mono text-cyber-text">
            Exercise {activeSession.currentExerciseIndex + 1}/{exerciseCount}
          </div>
          <span className="text-xs font-mono text-cyber-cyan">{formatDuration(elapsed)}</span>
        </div>
        <button
          onClick={() => {
            if (confirm('End this session?')) finishSession()
          }}
          className="text-xs font-mono text-cyber-dim border border-cyber-border px-3 py-1.5 rounded hover:text-cyber-red hover:border-cyber-red/40 transition-colors"
        >
          End
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-cyber-border rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-cyber-green rounded-full transition-all duration-500"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* Current exercise */}
      {currentExercise && (
        <div className="flex-1 flex flex-col items-center">
          <div className={`text-xs font-mono uppercase tracking-widest mb-2 ${isRestPhase ? 'text-cyber-yellow' : 'text-cyber-cyan'}`}>
            {isRestPhase ? 'Rest' : 'Exercise'}
          </div>
          <h2 className="text-xl font-mono font-bold text-cyber-text text-center mb-1">
            {isRestPhase ? 'Rest Time' : currentExercise.name}
          </h2>
          {!isRestPhase && (
            <div className="text-sm font-mono text-cyber-dim mb-6">
              Set {activeSession.currentSet} of {currentExercise.sets}
              {currentExercise.reps ? ` · ${currentExercise.reps} reps` : ''}
            </div>
          )}
          <div className="flex items-center gap-3 mb-4">
            {prevPerf ? (
              <span className="text-xs font-mono text-cyber-dim">Last: <span className="text-yellow-400 font-bold">{prevPerf.weightKg}kg{prevPerf.reps ? ` × ${prevPerf.reps}` : ''}</span></span>
            ) : (
              <span className="text-xs font-mono text-cyber-dim">No previous data</span>
            )}
          </div>
          {!isRestPhase && currentExercise.formCues && currentExercise.formCues.length > 0 && (
            <div className="w-full mb-4 space-y-1">
              {currentExercise.formCues.map((cue, i) => (
                <div key={i} className="flex gap-2 text-xs text-cyber-dim font-mono">
                  <span className="text-cyber-cyan flex-shrink-0">•</span>
                  <span>{cue}</span>
                </div>
              ))}
            </div>
          )}

          {/* Timer (for timed exercises or rest) */}
          {(isRestPhase || currentExercise.durationSeconds) ? (
            <div className="my-6">
              <TimerRing
                remaining={remaining}
                total={isRestPhase ? (currentExercise.restSeconds ?? 90) : (currentExercise.durationSeconds ?? 0)}
                size={200}
                color={isRestPhase ? '#ffcc00' : '#00e5ff'}
                label={isRestPhase ? 'rest' : 'hold'}
              />
            </div>
          ) : (
            <div className="my-8 flex flex-col items-center gap-2">
              {currentExercise.reps && (
                <div className="text-6xl font-mono font-bold text-cyber-text">{currentExercise.reps}</div>
              )}
              <div className="text-cyber-dim font-mono text-sm">reps</div>
            </div>
          )}

          {currentExercise.notes && (
            <p className="text-xs text-cyber-dim font-mono italic mb-4 text-center px-4">
              {currentExercise.notes}
            </p>
          )}

          {/* Controls */}
          <div className="w-full space-y-3 mt-auto">
            {!isRestPhase ? (
              <button
                onClick={handleCompleteSet}
                className="w-full py-4 rounded-xl bg-cyber-green text-cyber-black font-mono font-bold text-base shadow-glow-green active:scale-95 transition-transform"
              >
                COMPLETE SET
              </button>
            ) : (
              <button
                onClick={handleSkipRest}
                className="w-full py-4 rounded-xl bg-cyber-yellow/10 border border-cyber-yellow/40 text-cyber-yellow font-mono font-bold text-base active:scale-95 transition-transform"
              >
                SKIP REST
              </button>
            )}

            <div className="flex gap-3">
              <button
                onClick={handlePrevious}
                disabled={activeSession.currentExerciseIndex === 0}
                className="flex-1 py-3 rounded-lg border border-cyber-border text-cyber-dim font-mono text-sm hover:text-cyber-text transition-colors disabled:opacity-30"
              >
                ← Prev
              </button>
              <button
                onClick={handleSkipExercise}
                className="flex-1 py-3 rounded-lg border border-cyber-border text-cyber-dim font-mono text-sm hover:text-cyber-text transition-colors"
              >
                Skip →
              </button>
              <button onClick={openSwap} className="flex-1 py-3 rounded-lg border border-cyber-border text-cyber-dim font-mono text-sm hover:text-cyber-cyan transition-colors">
                Swap ⇄
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
