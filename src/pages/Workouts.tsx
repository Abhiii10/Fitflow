import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '@/db/db'
import { dayName, currentDayOfWeek } from '@/utils/date'

export function Workouts() {
  const plans = useLiveQuery(
    () => db.workoutPlans.filter((p) => !p.deletedAt).toArray(),
    []
  )

  const today = currentDayOfWeek()

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Workout Plans</h1>
        <Link
          to="/workouts/new"
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Plan
        </Link>
      </div>

      {plans && plans.length > 0 ? (
        <div className="space-y-3">
          {plans.map((plan) => {
            const isToday = plan.daysOfWeek.includes(today)
            return (
              <Link key={plan.id} to={`/workouts/${plan.id}`} className="card block group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-cyber-text group-hover:text-cyber-green transition-colors">
                        {plan.name}
                      </h2>
                      {isToday && (
                        <span className="text-[10px] font-mono bg-cyber-green/10 border border-cyber-green/30 text-cyber-green px-1.5 py-0.5 rounded-sm uppercase tracking-widest">
                          Today
                        </span>
                      )}
                    </div>
                    {plan.description && (
                      <p className="text-sm text-cyber-dim mt-0.5">{plan.description}</p>
                    )}
                    <div className="flex gap-1 mt-2">
                      {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                        <span
                          key={d}
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            plan.daysOfWeek.includes(d)
                              ? d === today
                                ? 'border-cyber-green text-cyber-green bg-cyber-green/10'
                                : 'border-cyber-cyan/50 text-cyber-cyan bg-cyber-cyan/5'
                              : 'border-cyber-border text-cyber-muted'
                          }`}
                        >
                          {dayName(d)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-cyber-dim group-hover:text-cyber-green transition-colors flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🏋️</div>
          <div className="text-cyber-text font-medium mb-1">No workout plans yet</div>
          <div className="text-cyber-dim text-sm mb-4">Create your first plan to get started</div>
          <Link to="/workouts/new" className="btn-primary inline-flex">
            Create Plan
          </Link>
        </div>
      )}
    </div>
  )
}
