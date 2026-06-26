import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { useStore } from '@/store/useStore'
import { ProgressRing } from '@/components/ProgressRing'
import { todayStr } from '@/utils/date'
import { generateId } from '@/utils/id'
import { format } from 'date-fns'
import type { CardioLog, SleepLog } from '@/types'

const CARDIO_TYPES = ['Incline Walk', 'Brisk Walk', 'Cycling', 'Elliptical', 'Rowing', 'Swim', 'Other']

export function StepsCardio() {
  const { profile } = useStore()
  const today = todayStr()

  const [stepsInput, setStepsInput] = useState('')
  const [cardioType, setCardioType] = useState('Incline Walk')
  const [cardioDuration, setCardioDuration] = useState('')
  const [sleepHours, setSleepHours] = useState('')
  const [sleepQuality, setSleepQuality] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [saving, setSaving] = useState(false)

  const stepsLog = useLiveQuery(() => db.stepLogs.where('date').equals(today).filter(l => !l.deletedAt).first(), [today])
  const cardioLogs = useLiveQuery(() => db.cardioLogs.where('date').equals(today).filter(l => !l.deletedAt).toArray(), [today])
  const sleepLog = useLiveQuery(() => db.sleepLogs.where('date').equals(today).filter(l => !l.deletedAt).first(), [today])

  const stepsGoalMin = profile?.stepsGoalMin ?? 8000
  const stepsGoalMax = profile?.stepsGoalMax ?? 12000
  const sleepGoalMin = profile?.sleepGoalMinH ?? 7
  const sleepGoalMax = profile?.sleepGoalMaxH ?? 9

  const steps = stepsLog?.steps ?? 0
  const stepsPct = Math.min(100, (steps / stepsGoalMax) * 100)
  const sleepH = sleepLog?.hoursSlept ?? 0
  const sleepPct = Math.min(100, (sleepH / sleepGoalMin) * 100)

  async function saveSteps() {
    const count = parseInt(stepsInput)
    if (isNaN(count) || count < 0) return
    setSaving(true)
    const now = Date.now()
    if (stepsLog) {
      await db.stepLogs.update(stepsLog.id, { steps: count, updatedAt: now, pendingSync: true, syncStatus: 'pending' })
    } else {
      await db.stepLogs.add({ id: generateId(), date: today, steps: count, updatedAt: now, pendingSync: true, syncStatus: 'pending' })
    }
    setStepsInput('')
    setSaving(false)
  }

  async function addCardio() {
    const minutes = parseInt(cardioDuration)
    if (isNaN(minutes) || minutes <= 0) return
    setSaving(true)
    const log: CardioLog = {
      id: generateId(),
      date: today,
      type: cardioType,
      durationMinutes: minutes,
      loggedAt: Date.now(),
      updatedAt: Date.now(),
      pendingSync: true,
      syncStatus: 'pending',
    }
    await db.cardioLogs.add(log)
    setCardioDuration('')
    setSaving(false)
  }

  async function saveSleep() {
    const hours = parseFloat(sleepHours)
    if (isNaN(hours) || hours <= 0) return
    setSaving(true)
    const now = Date.now()
    const log: SleepLog = {
      id: sleepLog?.id ?? generateId(),
      date: today,
      hoursSlept: hours,
      quality: sleepQuality,
      updatedAt: now,
      pendingSync: true,
      syncStatus: 'pending',
    }
    if (sleepLog) {
      await db.sleepLogs.put(log)
    } else {
      await db.sleepLogs.add(log)
    }
    setSleepHours('')
    setSaving(false)
  }

  async function deleteCardio(id: string) {
    await db.cardioLogs.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
      pendingSync: true,
      syncStatus: 'pending',
    })
  }

  const stepsColor = steps >= stepsGoalMin ? 'text-purple-400' : 'text-cyber-dim'

  return (
    <div className="page-container">
      <div className="mb-5">
        <h1 className="text-xl font-mono font-bold text-cyber-green tracking-tight">Steps & Cardio</h1>
        <p className="text-xs text-cyber-dim font-mono">{format(new Date(), 'EEEE, MMM d')}</p>
      </div>

      {/* Steps */}
      <h2 className="section-title">Steps</h2>
      <div className="card mb-4">
        <div className="flex items-center gap-4 mb-3">
          <ProgressRing value={stepsPct} size={64} strokeWidth={5} color="#a78bfa">
            <span className="text-[10px] font-mono text-purple-400">{Math.round(stepsPct)}%</span>
          </ProgressRing>
          <div>
            <div className={`text-3xl font-mono font-bold ${stepsColor}`}>{steps.toLocaleString()}</div>
            <div className="text-xs text-cyber-dim font-mono">Goal: {stepsGoalMin.toLocaleString()}–{stepsGoalMax.toLocaleString()}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder={steps > 0 ? `Current: ${steps.toLocaleString()}` : 'Enter steps'}
            value={stepsInput}
            onChange={e => setStepsInput(e.target.value)}
            className="flex-1 bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-purple-400/60"
          />
          <button
            onClick={saveSteps}
            disabled={saving || !stepsInput}
            className="px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 font-mono text-sm hover:bg-purple-500/20 transition-colors disabled:opacity-40"
          >
            {stepsLog ? 'Update' : 'Log'}
          </button>
        </div>
        <p className="text-[10px] text-cyber-dim font-mono mt-1">Updates replace today's step count</p>
      </div>

      {/* Cardio */}
      <h2 className="section-title">Cardio Sessions</h2>
      <div className="card mb-3">
        <div className="flex gap-2 mb-2">
          <select
            value={cardioType}
            onChange={e => setCardioType(e.target.value)}
            className="flex-1 bg-cyber-black border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-green/60"
          >
            {CARDIO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="number"
            placeholder="Min"
            value={cardioDuration}
            onChange={e => setCardioDuration(e.target.value)}
            className="w-20 bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-cyber-green/60"
          />
          <button
            onClick={addCardio}
            disabled={saving || !cardioDuration}
            className="px-4 py-2 rounded-lg bg-cyber-green/10 border border-cyber-green/30 text-cyber-green font-mono text-sm hover:bg-cyber-green/20 transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {cardioLogs && cardioLogs.length > 0 && (
        <div className="space-y-2 mb-4">
          {cardioLogs.map(log => (
            <div key={log.id} className="card flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-cyber-text">{log.type}</div>
                <div className="text-xs font-mono text-cyber-dim">{log.durationMinutes} min</div>
              </div>
              <button onClick={() => deleteCardio(log.id)} className="text-cyber-dim hover:text-red-400 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sleep */}
      <h2 className="section-title">Last Night's Sleep</h2>
      <div className="card mb-4">
        <div className="flex items-center gap-4 mb-3">
          <ProgressRing value={sleepPct} size={56} strokeWidth={5} color="#fb923c">
            <span className="text-[10px] font-mono text-orange-400">{sleepH > 0 ? `${sleepH}h` : '—'}</span>
          </ProgressRing>
          <div>
            <div className="text-xl font-mono font-bold text-cyber-text">{sleepH > 0 ? `${sleepH}h` : 'Not logged'}</div>
            <div className="text-xs text-cyber-dim font-mono">Goal: {sleepGoalMin}–{sleepGoalMax}h</div>
          </div>
        </div>
        <div className="flex gap-2 mb-2">
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            placeholder={sleepH > 0 ? `Current: ${sleepH}h` : 'Hours slept'}
            value={sleepHours}
            onChange={e => setSleepHours(e.target.value)}
            className="flex-1 bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-orange-400/60"
          />
          <button
            onClick={saveSleep}
            disabled={saving || !sleepHours}
            className="px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 font-mono text-sm hover:bg-orange-500/20 transition-colors disabled:opacity-40"
          >
            {sleepLog ? 'Update' : 'Log'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyber-dim">Quality:</span>
          {([1, 2, 3, 4, 5] as const).map(q => (
            <button
              key={q}
              onClick={() => setSleepQuality(q)}
              className={`w-7 h-7 rounded font-mono text-xs border transition-colors ${sleepQuality === q ? 'border-orange-400 text-orange-400 bg-orange-400/10' : 'border-cyber-border text-cyber-dim'}`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
