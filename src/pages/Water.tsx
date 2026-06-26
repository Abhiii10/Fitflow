import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { useStore } from '@/store/useStore'
import { WaterQuickAdd } from '@/components/WaterQuickAdd'
import { ProgressRing } from '@/components/ProgressRing'
import { todayStr, friendlyDate } from '@/utils/date'
import { format } from 'date-fns'

export function Water() {
  const { profile, setSyncStatus } = useStore()
  const today = todayStr()

  const waterGoal = profile?.waterGoalMl ?? 3500

  const todayLogs = useLiveQuery(
    () =>
      db.waterLogs
        .where('date')
        .equals(today)
        .filter((l) => !l.deletedAt)
        .reverse()
        .sortBy('loggedAt'),
    [today]
  )

  const recentLogs = useLiveQuery(
    () =>
      db.waterLogs
        .orderBy('loggedAt')
        .reverse()
        .filter((l) => !l.deletedAt && l.date !== today)
        .limit(20)
        .toArray(),
    [today]
  )

  const todayTotal = todayLogs?.reduce((sum, l) => sum + l.amountMl, 0) ?? 0
  const waterPct = Math.min(100, (todayTotal / waterGoal) * 100)
  const remaining = Math.max(0, waterGoal - todayTotal)

  async function deleteLog(id: string) {
    await db.waterLogs.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
      pendingSync: true,
      syncStatus: 'pending',
    })
    setSyncStatus('pending')
  }

  // Group recent logs by date
  const groupedRecent: Record<string, typeof recentLogs> = {}
  recentLogs?.forEach((log) => {
    if (!groupedRecent[log.date]) groupedRecent[log.date] = []
    groupedRecent[log.date]!.push(log)
  })

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Hydration</h1>
        <span className="text-xs font-mono text-cyber-dim">{format(new Date(), 'EEEE')}</span>
      </div>

      {/* Progress Ring */}
      <div className="flex justify-center mb-6">
        <ProgressRing value={waterPct} size={180} strokeWidth={14} color="#00e5ff">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-mono font-bold text-cyber-text">{todayTotal}</span>
            <span className="text-sm font-mono text-cyber-dim">/ {waterGoal} ml</span>
            {remaining > 0 ? (
              <span className="text-xs font-mono text-cyber-cyan mt-1">{remaining}ml to go</span>
            ) : (
              <span className="text-xs font-mono text-cyber-green mt-1">Goal reached!</span>
            )}
          </div>
        </ProgressRing>
      </div>

      {/* Quick Add */}
      <div className="card mb-4">
        <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-3">Add Water</h2>
        <WaterQuickAdd />
      </div>

      {/* Today's logs */}
      {todayLogs && todayLogs.length > 0 && (
        <div className="mb-4">
          <h2 className="section-title">Today</h2>
          <div className="space-y-2">
            {[...todayLogs].reverse().map((log) => (
              <div key={log.id} className="card flex items-center justify-between">
                <div>
                  <span className="text-cyber-cyan font-mono font-semibold">+{log.amountMl}ml</span>
                  <span className="text-xs font-mono text-cyber-dim ml-2">
                    {format(new Date(log.loggedAt), 'h:mm a')}
                  </span>
                </div>
                <button
                  onClick={() => deleteLog(log.id)}
                  className="p-1.5 text-cyber-dim hover:text-cyber-red transition-colors"
                  aria-label="Remove log"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {Object.keys(groupedRecent).length > 0 && (
        <div>
          <h2 className="section-title">History</h2>
          <div className="space-y-3">
            {Object.entries(groupedRecent)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, logs]) => {
                const total = logs!.reduce((sum, l) => sum + l.amountMl, 0)
                const pct = Math.min(100, (total / waterGoal) * 100)
                return (
                  <div key={date} className="card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-cyber-text">{friendlyDate(date)}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono ${pct >= 100 ? 'text-cyber-green' : 'text-cyber-dim'}`}>
                          {total}ml
                        </span>
                        {pct >= 100 && <span className="text-cyber-green text-xs">✓</span>}
                      </div>
                    </div>
                    <div className="h-1.5 bg-cyber-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyber-cyan rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {(!todayLogs || todayLogs.length === 0) && (!recentLogs || recentLogs.length === 0) && (
        <div className="card text-center py-8 text-cyber-dim font-mono text-sm">
          No water logs yet. Start tracking your hydration!
        </div>
      )}
    </div>
  )
}
