import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { friendlyDate, formatDuration } from '@/utils/date'
import { format } from 'date-fns'

export function History() {
  const sessions = useLiveQuery(
    () =>
      db.workoutSessions
        .orderBy('startedAt')
        .reverse()
        .filter((s) => !s.deletedAt && !!s.completedAt)
        .limit(50)
        .toArray(),
    []
  )

  const waterHistory = useLiveQuery(
    () =>
      db.waterLogs
        .orderBy('loggedAt')
        .reverse()
        .filter((l) => !l.deletedAt)
        .limit(100)
        .toArray(),
    []
  )

  // Group water by date
  const waterByDate: Record<string, number> = {}
  waterHistory?.forEach((log) => {
    waterByDate[log.date] = (waterByDate[log.date] ?? 0) + log.amountMl
  })

  return (
    <div className="page-container">
      <h1 className="page-title mb-6">History</h1>

      {/* Workout sessions */}
      <div className="mb-6">
        <h2 className="section-title">Workout Sessions</h2>
        {sessions && sessions.length > 0 ? (
          <div className="space-y-2">
            {sessions.map((session) => {
              const date = new Date(session.startedAt)
              const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
              return (
                <div key={session.id} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-cyber-text">{session.planName}</div>
                      <div className="text-xs font-mono text-cyber-dim mt-0.5">
                        {friendlyDate(dateKey)} · {format(date, 'h:mm a')}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {session.durationSeconds && (
                        <span className="text-xs font-mono text-cyber-cyan border border-cyber-cyan/30 px-2 py-0.5 rounded">
                          {formatDuration(session.durationSeconds)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card text-center py-8 text-cyber-dim font-mono text-sm">
            No completed sessions yet
          </div>
        )}
      </div>

      {/* Water history */}
      <div>
        <h2 className="section-title">Water History</h2>
        {Object.keys(waterByDate).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(waterByDate)
              .sort(([a], [b]) => b.localeCompare(a))
              .slice(0, 14)
              .map(([date, total]) => {
                const pct = Math.min(100, (total / 3500) * 100)
                return (
                  <div key={date} className="card">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-cyber-text">{friendlyDate(date)}</span>
                      <span className={`text-xs font-mono ${pct >= 100 ? 'text-cyber-green' : 'text-cyber-dim'}`}>
                        {total}ml {pct >= 100 ? '✓' : ''}
                      </span>
                    </div>
                    <div className="h-1.5 bg-cyber-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-cyber-green' : 'bg-cyber-cyan'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        ) : (
          <div className="card text-center py-8 text-cyber-dim font-mono text-sm">
            No water logs yet
          </div>
        )}
      </div>
    </div>
  )
}
