import type { RoutineItem } from '@/types'

export const ROUTINE_DAYS = [0, 1, 2, 3, 4, 5]

export const ROUTINE_COLOR_CLASSES: Record<RoutineItem['color'], string> = {
  green: 'text-cyber-green border-cyber-green/40 bg-cyber-green/5',
  cyan: 'text-cyber-cyan border-cyber-cyan/40 bg-cyber-cyan/5',
  yellow: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/5',
  red: 'text-red-400 border-red-400/40 bg-red-400/5',
  purple: 'text-purple-400 border-purple-400/40 bg-purple-400/5',
}

export function getRoutineEventsForDay(items: RoutineItem[] | undefined, dayNumber: number) {
  return (items ?? [])
    .filter((event) => event.enabled && !event.deletedAt && event.dayNumbers.includes(dayNumber))
    .sort((a, b) => a.time.localeCompare(b.time))
}

export function isRoutineDay(dayNumber: number) {
  return ROUTINE_DAYS.includes(dayNumber)
}

export function formatRoutineTime(time: string) {
  const [hourText, minuteText] = time.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time

  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
}
