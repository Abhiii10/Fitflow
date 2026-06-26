import { ProgressRing } from './ProgressRing'
import { formatTime } from '@/utils/date'

interface TimerRingProps {
  remaining: number
  total: number
  size?: number
  color?: string
  label?: string
}

export function TimerRing({ remaining, total, size = 160, color = '#00e5ff', label }: TimerRingProps) {
  const progress = total > 0 ? (remaining / total) * 100 : 0

  return (
    <ProgressRing value={progress} size={size} strokeWidth={10} color={color}>
      <div className="flex flex-col items-center">
        <span className="text-3xl font-mono font-bold text-cyber-text tabular-nums">
          {formatTime(remaining)}
        </span>
        {label && (
          <span className="text-xs font-mono text-cyber-dim mt-1 uppercase tracking-widest">
            {label}
          </span>
        )}
      </div>
    </ProgressRing>
  )
}
