import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { generateId } from '@/utils/id'
import { format, startOfWeek } from 'date-fns'
import type { WeeklyCheckIn as WeeklyCheckInType } from '@/types'

function weekStartStr() {
  const d = startOfWeek(new Date(), { weekStartsOn: 0 })
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const ADJUSTMENT_GUIDE = [
  {
    scenario: 'Weight not dropping for 2 weeks',
    action: 'Add +2,000 steps/day OR reduce calories by ~150kcal',
    color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5',
  },
  {
    scenario: 'Weight dropping too fast (>1kg/week)',
    action: 'Add 150–200kcal on training days (carbs + protein)',
    color: 'text-blue-400 border-blue-400/30 bg-blue-400/5',
  },
  {
    scenario: 'Strength dropping on compounds',
    action: 'Add 150–250kcal on training days OR reduce cardio by 10min',
    color: 'text-red-400 border-red-400/30 bg-red-400/5',
  },
  {
    scenario: 'Sleep averaging <7h',
    action: 'Prioritise sleep BEFORE adding training volume',
    color: 'text-orange-400 border-orange-400/30 bg-orange-400/5',
  },
  {
    scenario: 'Protein consistently below 140g',
    action: 'Add one protein-rich snack (30g shake or Greek yogurt)',
    color: 'text-purple-400 border-purple-400/30 bg-purple-400/5',
  },
]

export function WeeklyCheckIn() {
  const weekStart = weekStartStr()

  const existing = useLiveQuery(
    () => db.weeklyCheckIns.where('weekStartDate').equals(weekStart).first(),
    [weekStart]
  )

  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [sessionsCompleted, setSessionsCompleted] = useState('0')
  const [avgSteps, setAvgSteps] = useState('')
  const [avgProtein, setAvgProtein] = useState('')
  const [avgSleep, setAvgSleep] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  async function handleSave() {
    const data: WeeklyCheckInType = {
      id: existing?.id ?? generateId(),
      weekStartDate: weekStart,
      weightKg: weight ? parseFloat(weight) : undefined,
      waistCm: waist ? parseFloat(waist) : undefined,
      sessionsCompleted: parseInt(sessionsCompleted) || 0,
      avgDailySteps: avgSteps ? parseInt(avgSteps) : undefined,
      avgProteinG: avgProtein ? parseFloat(avgProtein) : undefined,
      avgSleepH: avgSleep ? parseFloat(avgSleep) : undefined,
      notes: notes || undefined,
      completedAt: Date.now(),
      updatedAt: Date.now(),
      pendingSync: true,
      syncStatus: 'pending',
    }
    setSaving(true)
    if (existing) {
      await db.weeklyCheckIns.put(data)
    } else {
      await db.weeklyCheckIns.add(data)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="page-container">
      <div className="mb-5">
        <h1 className="text-xl font-mono font-bold text-cyber-green tracking-tight">Weekly Check-In</h1>
        <p className="text-xs text-cyber-dim font-mono">Week of {format(new Date(weekStart + 'T12:00:00'), 'MMM d, yyyy')}</p>
      </div>

      {existing && (
        <div className="mb-4 p-3 rounded-lg border border-cyber-green/30 bg-cyber-green/5">
          <div className="text-xs font-mono text-cyber-green">Check-in submitted — edit below to update</div>
          {existing.weightKg && (
            <div className="text-sm text-cyber-text mt-1">
              Weight: <span className="font-mono text-cyber-green">{existing.weightKg}kg</span>
              {existing.waistCm && <> · Waist: <span className="font-mono text-cyber-green">{existing.waistCm}cm</span></>}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 mb-4">
        {/* Measurements */}
        <div className="card">
          <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-3">Body Measurements</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono text-cyber-dim mb-1 block">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                placeholder={existing?.weightKg?.toString() ?? '0.0'}
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className="w-full bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim/50 focus:outline-none focus:border-cyber-green/60"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-cyber-dim mb-1 block">Waist (cm)</label>
              <input
                type="number"
                step="0.5"
                placeholder={existing?.waistCm?.toString() ?? '0.0'}
                value={waist}
                onChange={e => setWaist(e.target.value)}
                className="w-full bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim/50 focus:outline-none focus:border-cyber-green/60"
              />
            </div>
          </div>
        </div>

        {/* Sessions */}
        <div className="card">
          <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-3">Training</h2>
          <label className="text-xs font-mono text-cyber-dim mb-1 block">Sessions completed this week</label>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                onClick={() => setSessionsCompleted(String(n))}
                className={`flex-1 py-2 rounded-lg border font-mono text-sm transition-colors ${sessionsCompleted === String(n) ? 'border-cyber-green text-cyber-green bg-cyber-green/10' : 'border-cyber-border text-cyber-dim'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Weekly Averages */}
        <div className="card">
          <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-3">Weekly Averages</h2>
          <div className="space-y-2">
            <div>
              <label className="text-xs font-mono text-cyber-dim mb-1 block">Avg daily steps</label>
              <input
                type="number"
                placeholder={existing?.avgDailySteps?.toString() ?? '8000'}
                value={avgSteps}
                onChange={e => setAvgSteps(e.target.value)}
                className="w-full bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim/50 focus:outline-none focus:border-purple-400/60"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-cyber-dim mb-1 block">Avg daily protein (g)</label>
              <input
                type="number"
                placeholder={existing?.avgProteinG?.toString() ?? '150'}
                value={avgProtein}
                onChange={e => setAvgProtein(e.target.value)}
                className="w-full bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim/50 focus:outline-none focus:border-blue-400/60"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-cyber-dim mb-1 block">Avg sleep (hours)</label>
              <input
                type="number"
                step="0.5"
                placeholder={existing?.avgSleepH?.toString() ?? '7.5'}
                value={avgSleep}
                onChange={e => setAvgSleep(e.target.value)}
                className="w-full bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim/50 focus:outline-none focus:border-orange-400/60"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-2">Notes / Observations</h2>
          <textarea
            placeholder="How did you feel? Any pain? Progress on lifts? Sleep quality?"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim/50 focus:outline-none focus:border-cyber-green/60 resize-none"
          />
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-cyber-green/10 border border-cyber-green/40 text-cyber-green font-mono font-semibold text-sm hover:bg-cyber-green/20 transition-colors disabled:opacity-40 mb-6"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : existing ? 'Update Check-In' : 'Submit Check-In'}
      </button>

      {/* Adjustment Guide */}
      <div>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center justify-between w-full mb-3"
        >
          <h2 className="section-title !mb-0">Adjustment Guide</h2>
          <svg className={`w-4 h-4 text-cyber-dim transition-transform ${showGuide ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {showGuide && (
          <div className="space-y-2">
            {ADJUSTMENT_GUIDE.map((item, i) => (
              <div key={i} className={`p-3 rounded-lg border ${item.color}`}>
                <div className="text-xs font-mono font-semibold mb-1">{item.scenario}</div>
                <div className="text-sm text-cyber-text">{item.action}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
