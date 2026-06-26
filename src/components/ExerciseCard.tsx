import type { Exercise } from '@/types'
import { formatDuration } from '@/utils/date'

interface ExerciseCardProps {
  exercise: Exercise
  index: number
  isActive?: boolean
  onEdit?: () => void
  onDelete?: () => void
  dragHandle?: React.ReactNode
}

export function ExerciseCard({
  exercise,
  index,
  isActive,
  onEdit,
  onDelete,
  dragHandle,
}: ExerciseCardProps) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
        isActive
          ? 'border-cyber-cyan/50 bg-cyber-cyan/5 shadow-glow-cyan'
          : 'border-cyber-border bg-cyber-card'
      }`}
    >
      {dragHandle}
      <div className="flex-shrink-0 w-7 h-7 rounded bg-cyber-panel border border-cyber-border flex items-center justify-center text-xs font-mono text-cyber-dim">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-cyber-text text-sm truncate">{exercise.name}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
          <span className="text-xs font-mono text-cyber-green">
            {exercise.sets}×{exercise.reps ? exercise.reps : formatDuration(exercise.durationSeconds ?? 0)}
          </span>
          <span className="text-xs font-mono text-cyber-dim">
            rest {formatDuration(exercise.restSeconds)}
          </span>
        </div>
        {exercise.notes && (
          <p className="text-xs text-cyber-dim mt-1 italic">{exercise.notes}</p>
        )}
      </div>
      {(onEdit || onDelete) && (
        <div className="flex gap-1">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 text-cyber-dim hover:text-cyber-cyan transition-colors"
              aria-label="Edit exercise"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 text-cyber-dim hover:text-cyber-red transition-colors"
              aria-label="Delete exercise"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
