import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '@/db/db'
import { format, subDays } from 'date-fns'
import { useStore } from '@/store/useStore'
import { getAIProvider } from '@/lib/ai/aiProvider'
import type { WeeklySummary } from '@/lib/ai/schemas'
import { generateId } from '@/utils/id'

// Very minimal sparkline using SVG
function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return <div className="h-10 flex items-center justify-center text-[10px] font-mono text-cyber-dim">Not enough data</div>
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 200
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((v - min) / range) * (height - 4) - 2
        return <circle key={i} cx={x} cy={y} r={3} fill={color} />
      })}
    </svg>
  )
}

function WorkoutHeatmap({ sessionDates }: { sessionDates: string[] }) {
  const dateSet = new Set(sessionDates)
  const days = Array.from({ length: 91 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (90 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  return (
    <div>
      <div className="flex gap-0.5 mb-1">
        {dayLabels.map((l, i) => (
          <div key={i} className="w-3 text-[8px] font-mono text-cyber-dim text-center">{l}</div>
        ))}
      </div>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}>
        {days.map((day, i) => (
          <div
            key={i}
            title={day}
            className={`h-3 rounded-sm ${dateSet.has(day) ? 'bg-cyber-green' : 'bg-cyber-border/50'}`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-cyber-dim">13 weeks ago</span>
        <span className="text-[9px] font-mono text-cyber-dim">Today</span>
      </div>
    </div>
  )
}

function WeeklyVolume({ sessions }: { sessions: Array<{ startedAt: number }> }) {
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - (7 * (7 - i)) - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const count = sessions.filter(s => s.startedAt >= weekStart.getTime() && s.startedAt < weekEnd.getTime()).length
    return { count, label: `W${i + 1}` }
  })
  const max = Math.max(...weeks.map(w => w.count), 1)
  return (
    <div className="flex items-end gap-1 h-16">
      {weeks.map((w, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm bg-cyber-cyan/50 transition-all"
            style={{ height: `${Math.max(4, (w.count / max) * 52)}px` }}
          />
          <span className="text-[8px] font-mono text-cyber-dim">{w.count}</span>
        </div>
      ))}
    </div>
  )
}

export function Progress() {
  const { profile } = useStore()
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summary, setSummary] = useState<WeeklySummary | null>(null)
  const [summaryError, setSummaryError] = useState('')

  // Feature 1: Daily Weight Logger state
  const [weightInput, setWeightInput] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  // Feature 4: Progress Photos state
  const [photoNote, setPhotoNote] = useState('')

  // Feature 5: Shareable Progress Card state
  const [showShare, setShowShare] = useState(false)

  const checkIns = useLiveQuery(
    () => db.weeklyCheckIns.orderBy('weekStartDate').reverse().limit(12).toArray(),
    []
  )

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const waterLogs = useLiveQuery(
    () => db.waterLogs.where('date').anyOf(last30Days).filter(l => !l.deletedAt).toArray(),
    []
  )

  const proteinLogs = useLiveQuery(
    () => db.proteinLogs.where('date').anyOf(last30Days).filter(l => !l.deletedAt).toArray(),
    []
  )

  const stepLogs = useLiveQuery(
    () => db.stepLogs.where('date').anyOf(last30Days).toArray(),
    []
  )

  const sessions = useLiveQuery(
    () => db.workoutSessions.filter(s => !s.deletedAt && !!s.completedAt).toArray(),
    []
  )

  // Feature 1: Weight history query (must be before badges computation)
  const today = new Date().toISOString().slice(0, 10)
  const weightHistory = useLiveQuery(() => db.weightLogs.orderBy('date').reverse().limit(30).toArray(), [])
  const todayWeight = weightHistory?.find(w => w.date === today)

  // Feature 4: Photos query (must be before badges computation)
  const photos = useLiveQuery(() => db.photoLogs.orderBy('date').reverse().limit(20).toArray(), [])

  // Build weight and waist trend from check-ins
  const weightTrend = checkIns?.filter(c => c.weightKg).slice().reverse() ?? []

  // Daily water totals for sparkline (last 14 days)
  const last14 = last30Days.slice(16)
  const waterByDay = last14.map(day => {
    return (waterLogs ?? []).filter(l => l.date === day).reduce((s, l) => s + l.amountMl, 0)
  })

  const proteinByDay = last14.map(day => {
    return (proteinLogs ?? []).filter(l => l.date === day).reduce((s, l) => s + l.amountG, 0)
  })

  const stepsByDay = last14.map(day => {
    return (stepLogs ?? []).find(l => l.date === day)?.steps ?? 0
  })

  const exercisePRs = useLiveQuery(async () => {
    const logs = await db.sessionExerciseLogs.filter(l => !!l.weightKg).toArray()
    const prMap: Record<string, { weightKg: number; reps?: number; date: number }> = {}
    for (const log of logs) {
      if (!log.weightKg) continue
      const existing = prMap[log.exerciseName]
      if (!existing || log.weightKg > existing.weightKg) {
        prMap[log.exerciseName] = { weightKg: log.weightKg, reps: log.repsCompleted, date: log.completedAt }
      }
    }
    return Object.entries(prMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.weightKg - a.weightKg)
  }, [])

  const totalSessions = sessions?.length ?? 0
  const avgSessionsPerWeek = totalSessions > 0 ? (totalSessions / Math.max(1, Math.ceil((Date.now() - (sessions?.[sessions.length - 1]?.startedAt ?? Date.now())) / (7 * 24 * 3600 * 1000)))).toFixed(1) : '0'

  const latestCheckIn = checkIns?.[0]
  const prevCheckIn = checkIns?.[1]
  const weightDelta = latestCheckIn?.weightKg && prevCheckIn?.weightKg
    ? (latestCheckIn.weightKg - prevCheckIn.weightKg).toFixed(1)
    : null
  const waistDelta = latestCheckIn?.waistCm && prevCheckIn?.waistCm
    ? (latestCheckIn.waistCm - prevCheckIn.waistCm).toFixed(1)
    : null

  // Feature 2: Deload Reminder
  const shouldDeload = (() => {
    if (!sessions || sessions.length < 12) return false
    const fourWeeksAgo = Date.now() - 28 * 24 * 3600 * 1000
    const recent = sessions.filter(s => s.startedAt > fourWeeksAgo)
    return recent.length >= 16
  })()

  // Feature 3: Achievement Badges
  const badges = (() => {
    const s = sessions ?? []
    const prs = exercisePRs ?? []
    const earned: { icon: string; label: string; desc: string }[] = []
    if (s.length >= 1) earned.push({ icon: '🏋️', label: 'First Rep', desc: 'Completed your first workout' })
    if (s.length >= 10) earned.push({ icon: '💪', label: 'Getting Serious', desc: '10 sessions completed' })
    if (s.length >= 30) earned.push({ icon: '🔥', label: 'Dedicated', desc: '30 sessions logged' })
    if (s.length >= 100) earned.push({ icon: '💯', label: 'Century Club', desc: '100 sessions total' })
    if (prs.length >= 1) earned.push({ icon: '🏆', label: 'PR Breaker', desc: 'Set your first personal record' })
    if (prs.length >= 5) earned.push({ icon: '⚡', label: 'Power House', desc: '5+ personal records set' })
    const wk = weightHistory?.length ?? 0
    if (wk >= 7) earned.push({ icon: '📊', label: 'Scale Tracker', desc: 'Logged weight 7 days' })
    return earned
  })()

  // Feature 1: Save weight function
  async function saveWeight() {
    const kg = parseFloat(weightInput)
    if (isNaN(kg) || kg <= 0) return
    setSavingWeight(true)
    const existing = await db.weightLogs.where('date').equals(today).first()
    if (existing) {
      await db.weightLogs.update(existing.id, { weightKg: kg, updatedAt: Date.now() })
    } else {
      await db.weightLogs.add({ id: generateId(), date: today, weightKg: kg, updatedAt: Date.now() })
    }
    setWeightInput('')
    setSavingWeight(false)
  }

  // Feature 4: Photo upload function
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const canvas = document.createElement('canvas')
    const img = new Image()
    img.onload = async () => {
      const MAX = 800
      const scale = Math.min(MAX / img.width, MAX / img.height, 1)
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      await db.photoLogs.add({
        id: generateId(),
        date: new Date().toISOString().slice(0, 10),
        dataUrl,
        note: photoNote || undefined,
        updatedAt: Date.now(),
      })
      setPhotoNote('')
    }
    img.src = URL.createObjectURL(file)
  }

  // Feature 5: Share function
  async function handleShare() {
    const text = [
      `💪 FitFlow Progress`,
      `📅 ${new Date().toDateString()}`,
      `🏋️ Sessions: ${totalSessions} total`,
      `🔥 Streak: calculating...`,
      latestCheckIn?.weightKg ? `⚖️ Weight: ${latestCheckIn.weightKg}kg` : null,
      exercisePRs && exercisePRs.length > 0 ? `🏆 PRs: ${exercisePRs.length} exercises` : null,
      badges.length > 0 ? `⭐ Badges: ${badges.map(b => b.icon + b.label).join(', ')}` : null,
    ].filter(Boolean).join('\n')

    if (navigator.share) {
      await navigator.share({ title: 'My FitFlow Progress', text })
    } else {
      setShowShare(true)
    }
  }

  async function handleGenerateSummary() {
    setSummaryLoading(true)
    setSummaryError('')
    setSummary(null)
    try {
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })
      const [water7, protein7, steps7, sleep7, sessions7] = await Promise.all([
        db.waterLogs.where('date').anyOf(last7).filter(l => !l.deletedAt).toArray(),
        db.proteinLogs.where('date').anyOf(last7).filter(l => !l.deletedAt).toArray(),
        db.stepLogs.where('date').anyOf(last7).toArray(),
        db.sleepLogs.where('date').anyOf(last7).toArray(),
        db.workoutSessions.filter(s => !s.deletedAt && !!s.completedAt && last7.includes(
          new Date(s.startedAt).toISOString().slice(0, 10)
        )).toArray(),
      ])
      const avgWater = water7.reduce((s, l) => s + l.amountMl, 0) / 7
      const avgProtein = protein7.reduce((s, l) => s + l.amountG, 0) / 7
      const avgSteps = steps7.length > 0 ? steps7.reduce((s, l) => s + l.steps, 0) / steps7.length : 0
      const avgSleep = sleep7.length > 0 ? sleep7.reduce((s, l) => s + l.hoursSlept, 0) / sleep7.length : 0

      const sessionDates = (sessions ?? []).map(s => new Date(s.startedAt).toISOString().slice(0, 10))
      const uniqueDays = [...new Set(sessionDates)].sort().reverse()
      let streak = 0
      for (let i = 0; i < uniqueDays.length; i++) {
        const expected = subDays(new Date(), i).toISOString().slice(0, 10)
        if (uniqueDays[i] === expected) streak++
        else break
      }

      const ai = getAIProvider()
      const result = await ai.generateWeeklySummary({
        checkIn: latestCheckIn ?? undefined,
        sessionsCompleted: sessions7.length,
        avgWaterMl: Math.round(avgWater),
        avgProteinG: Math.round(avgProtein),
        avgSteps: Math.round(avgSteps),
        avgSleepH: Math.round(avgSleep * 10) / 10,
        streak,
      })
      setSummary(result)
    } catch {
      setSummaryError('AI unavailable. Add a Gemini API key in Settings.')
    }
    setSummaryLoading(false)
  }

  return (
    <div className="page-container">
      <div className="mb-5">
        <h1 className="text-xl font-mono font-bold text-cyber-green tracking-tight">Progress</h1>
        <p className="text-xs text-cyber-dim font-mono">Trends & tracking</p>
      </div>

      {/* Feature 2: Deload Reminder */}
      {shouldDeload && (
        <div className="mb-4 p-3 rounded-xl border border-yellow-400/40 bg-yellow-400/5">
          <div className="text-xs font-mono text-yellow-400 uppercase tracking-widest mb-1">Deload Reminder</div>
          <p className="text-sm text-cyber-text">You've trained hard for 4+ weeks. Consider a deload week — reduce weight by 40-50%, keep reps the same. Your body will come back stronger.</p>
        </div>
      )}

      {/* Feature 1: Daily Weight Logger */}
      <h2 className="section-title">Today's Weight</h2>
      <div className="card mb-4">
        <div className="flex gap-2 mb-2">
          <input
            type="number"
            step="0.1"
            placeholder={todayWeight ? `${todayWeight.weightKg}kg logged` : 'e.g. 72.5'}
            value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            className="flex-1 bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-cyber-green/60"
          />
          <button onClick={saveWeight} disabled={savingWeight || !weightInput} className="px-4 py-2 rounded-lg bg-cyber-green/10 border border-cyber-green/30 text-cyber-green font-mono text-sm hover:bg-cyber-green/20 transition-colors disabled:opacity-40">
            {savingWeight ? '...' : 'Log'}
          </button>
        </div>
        {weightHistory && weightHistory.length >= 2 && (
          <div className="flex items-end gap-1 h-10 mt-2">
            {weightHistory.slice(0, 14).reverse().map((w, i) => {
              const vals = weightHistory.slice(0, 14).map(x => x.weightKg)
              const min = Math.min(...vals); const max = Math.max(...vals)
              const pct = max === min ? 50 : ((w.weightKg - min) / (max - min)) * 80 + 10
              return <div key={i} className="flex-1 rounded-t-sm bg-cyber-green/50" style={{ height: `${pct}%` }} title={`${w.date}: ${w.weightKg}kg`} />
            })}
          </div>
        )}
      </div>

      {/* Weekly Check-In CTA */}
      <Link to="/checkin" className="block mb-4 p-3 rounded-lg border border-cyber-green/30 bg-cyber-green/5 hover:bg-cyber-green/10 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-cyber-green uppercase tracking-widest">Weekly Check-In</div>
            <div className="text-sm text-cyber-text mt-0.5">Log weight, waist, sessions, sleep</div>
          </div>
          <svg className="w-5 h-5 text-cyber-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </Link>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card">
          <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-1">Total Sessions</div>
          <div className="text-2xl font-mono font-bold text-cyber-green">{totalSessions}</div>
          <div className="text-xs text-cyber-dim font-mono">{avgSessionsPerWeek}/wk avg</div>
        </div>
        <div className="card">
          <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-1">Weight</div>
          {latestCheckIn?.weightKg ? (
            <>
              <div className="text-2xl font-mono font-bold text-cyber-text">{latestCheckIn.weightKg}kg</div>
              {weightDelta !== null && (
                <div className={`text-xs font-mono ${parseFloat(weightDelta) < 0 ? 'text-cyber-green' : parseFloat(weightDelta) > 0 ? 'text-yellow-400' : 'text-cyber-dim'}`}>
                  {parseFloat(weightDelta) > 0 ? '+' : ''}{weightDelta}kg vs prev week
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-cyber-dim font-mono">No data yet</div>
          )}
        </div>
        <div className="card">
          <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-1">Waist</div>
          {latestCheckIn?.waistCm ? (
            <>
              <div className="text-2xl font-mono font-bold text-cyber-text">{latestCheckIn.waistCm}cm</div>
              {waistDelta !== null && (
                <div className={`text-xs font-mono ${parseFloat(waistDelta) < 0 ? 'text-cyber-green' : parseFloat(waistDelta) > 0 ? 'text-yellow-400' : 'text-cyber-dim'}`}>
                  {parseFloat(waistDelta) > 0 ? '+' : ''}{waistDelta}cm vs prev week
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-cyber-dim font-mono">No data yet</div>
          )}
        </div>
        <div className="card">
          <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-1">Check-Ins</div>
          <div className="text-2xl font-mono font-bold text-cyber-cyan">{checkIns?.length ?? 0}</div>
          <div className="text-xs text-cyber-dim font-mono">weeks logged</div>
        </div>
      </div>

      {/* Sparklines */}
      <h2 className="section-title">Last 14 Days</h2>

      <div className="space-y-3 mb-4">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-cyber-dim uppercase tracking-widest">Water (ml/day)</span>
            <span className="text-xs font-mono text-cyber-green">Goal: {profile?.waterGoalMl ?? 3500}ml</span>
          </div>
          <Sparkline data={waterByDay.filter(v => v > 0)} color="#00ff87" />
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-cyber-dim uppercase tracking-widest">Protein (g/day)</span>
            <span className="text-xs font-mono text-blue-400">Goal: {profile?.proteinGoalMinG ?? 140}–{profile?.proteinGoalMaxG ?? 160}g</span>
          </div>
          <Sparkline data={proteinByDay.filter(v => v > 0)} color="#60a5fa" />
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-cyber-dim uppercase tracking-widest">Steps/day</span>
            <span className="text-xs font-mono text-purple-400">Goal: {(profile?.stepsGoalMin ?? 8000).toLocaleString()}</span>
          </div>
          <Sparkline data={stepsByDay.filter(v => v > 0)} color="#a78bfa" />
        </div>
      </div>

      {/* Weight trend from check-ins */}
      {weightTrend.length >= 2 && (
        <>
          <h2 className="section-title">Weight Trend</h2>
          <div className="card mb-4">
            <Sparkline data={weightTrend.map(c => c.weightKg!)} color="#00ff87" height={60} />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] font-mono text-cyber-dim">
                {format(new Date(weightTrend[0].weekStartDate + 'T12:00:00'), 'MMM d')}
              </span>
              <span className="text-[10px] font-mono text-cyber-dim">
                {format(new Date(weightTrend[weightTrend.length - 1].weekStartDate + 'T12:00:00'), 'MMM d')}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Workout Heatmap */}
      <h2 className="section-title">Workout Heatmap</h2>
      <div className="card mb-4">
        <WorkoutHeatmap sessionDates={
          (sessions ?? []).map(s => {
            const d = new Date(s.startedAt)
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          })
        } />
      </div>

      {/* Weekly Volume */}
      <h2 className="section-title">Weekly Sessions</h2>
      <div className="card mb-4">
        <WeeklyVolume sessions={sessions ?? []} />
      </div>

      {/* Personal Records */}
      {exercisePRs && exercisePRs.length > 0 && (
        <>
          <h2 className="section-title">Personal Records</h2>
          <div className="card mb-4 space-y-2">
            {exercisePRs.map(pr => (
              <div key={pr.name} className="flex items-center justify-between">
                <div className="text-sm text-cyber-text truncate flex-1 mr-3">{pr.name}</div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-mono font-bold text-yellow-400">{pr.weightKg}kg</span>
                  {pr.reps && <span className="font-mono text-xs text-cyber-dim">×{pr.reps}</span>}
                  {pr.weightKg && pr.reps && (
                    <span className="font-mono text-[10px] text-cyber-dim border border-cyber-border px-1.5 py-0.5 rounded">
                      ~{(pr.weightKg * (1 + pr.reps / 30)).toFixed(1)} 1RM
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Feature 3: Achievement Badges */}
      {badges.length > 0 && (
        <>
          <h2 className="section-title">Achievements</h2>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {badges.map(b => (
              <div key={b.label} className="card flex items-center gap-3">
                <span className="text-2xl">{b.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-cyber-text">{b.label}</div>
                  <div className="text-[10px] font-mono text-cyber-dim">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Feature 4: Progress Photos */}
      <h2 className="section-title">Progress Photos</h2>
      <div className="mb-4">
        <label className="block w-full cursor-pointer">
          <div className="card flex items-center justify-center gap-2 border-dashed border-cyber-green/30 hover:border-cyber-green/60 transition-colors py-4 mb-3">
            <span className="text-cyber-green text-lg">📷</span>
            <span className="text-sm font-mono text-cyber-dim">Add photo</span>
          </div>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
        </label>
        {photos && photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map(p => (
              <div key={p.id} className="relative rounded-xl overflow-hidden aspect-square bg-cyber-panel">
                <img src={p.dataUrl} alt={p.date} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1">
                  <div className="text-[9px] font-mono text-cyber-dim">{p.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly AI Summary */}
      <h2 className="section-title">AI Weekly Summary</h2>
      <div className="card mb-4">
        {!summary ? (
          <>
            <p className="text-xs text-cyber-dim font-mono mb-3">Generate a personalised recap of the last 7 days based on your logged data.</p>
            {summaryError && <div className="text-xs text-red-400 font-mono mb-2">{summaryError}</div>}
            <button onClick={handleGenerateSummary} disabled={summaryLoading} className="btn-secondary w-full">
              {summaryLoading ? 'Generating...' : 'Generate AI Summary'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-cyber-text leading-relaxed mb-3">{summary.narrative}</p>
            {summary.highlights.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-mono uppercase tracking-widest text-cyber-green mb-1">Highlights</div>
                {summary.highlights.map((h, i) => (
                  <div key={i} className="flex gap-2 text-sm text-cyber-text"><span className="text-cyber-green">•</span>{h}</div>
                ))}
              </div>
            )}
            {summary.recommendations.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-mono uppercase tracking-widest text-cyber-cyan mb-1">This Week</div>
                {summary.recommendations.map((r, i) => (
                  <div key={i} className="flex gap-2 text-sm text-cyber-text"><span className="text-cyber-cyan">→</span>{r}</div>
                ))}
              </div>
            )}
            <div className="rounded-lg border border-cyber-border bg-cyber-black/30 px-3 py-2 text-xs font-mono text-cyber-dim">{summary.nextWeekFocus}</div>
            <button onClick={() => setSummary(null)} className="btn-secondary mt-3 w-full text-cyber-dim">Regenerate</button>
          </>
        )}
      </div>

      {/* Feature 5: Share Progress */}
      <button onClick={handleShare} className="w-full btn-secondary mb-4 flex items-center justify-center gap-2">
        <span>📤</span> Share Progress
      </button>

      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setShowShare(false)}>
          <div className="card w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-3">Copy & Share</div>
            <div className="bg-cyber-panel rounded-lg p-3 text-sm font-mono text-cyber-text whitespace-pre-wrap mb-3">
              {`💪 FitFlow Progress\n📅 ${new Date().toDateString()}\n🏋️ Sessions: ${totalSessions}\n⭐ Badges: ${badges.length}`}
            </div>
            <button onClick={() => setShowShare(false)} className="btn-secondary w-full">Close</button>
          </div>
        </div>
      )}

      {/* Check-in history */}
      {checkIns && checkIns.length > 0 && (
        <>
          <h2 className="section-title">Check-In History</h2>
          <div className="space-y-2">
            {checkIns.map(ci => (
              <div key={ci.id} className="card">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-cyber-dim">
                    Week of {format(new Date(ci.weekStartDate + 'T12:00:00'), 'MMM d')}
                  </span>
                  <span className="text-xs font-mono text-cyber-green">{ci.sessionsCompleted} sessions</span>
                </div>
                <div className="flex gap-4 text-sm font-mono">
                  {ci.weightKg && <span className="text-cyber-text">{ci.weightKg}kg</span>}
                  {ci.waistCm && <span className="text-cyber-dim">{ci.waistCm}cm waist</span>}
                  {ci.avgProteinG && <span className="text-blue-400">{ci.avgProteinG}g prot</span>}
                  {ci.avgSleepH && <span className="text-orange-400">{ci.avgSleepH}h sleep</span>}
                </div>
                {ci.notes && <p className="text-xs text-cyber-dim mt-1 italic">{ci.notes}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {(!checkIns || checkIns.length === 0) && (
        <div className="card text-center py-8">
          <div className="text-cyber-dim font-mono text-sm mb-2">No check-ins yet</div>
          <Link to="/checkin" className="text-cyber-green font-mono text-sm hover:underline">
            Do your first check-in →
          </Link>
        </div>
      )}
    </div>
  )
}
