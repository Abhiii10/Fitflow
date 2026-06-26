import { format, isToday, isYesterday, startOfDay, differenceInCalendarDays } from 'date-fns'

export function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function dateStr(date: Date | number): string {
  return format(typeof date === 'number' ? new Date(date) : date, 'yyyy-MM-dd')
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export function friendlyDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d, yyyy')
}

export function dayName(dayIndex: number): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex] ?? ''
}

export function fullDayName(dayIndex: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex] ?? ''
}

export function currentDayOfWeek(): number {
  return new Date().getDay()
}

export function calcStreak(sessionDates: string[]): number {
  if (sessionDates.length === 0) return 0

  const uniqueDays = [...new Set(sessionDates)].sort().reverse()
  let streak = 0
  let checkDate = startOfDay(new Date())

  for (const d of uniqueDays) {
    const sessionDay = startOfDay(new Date(d + 'T00:00:00'))
    const diff = differenceInCalendarDays(checkDate, sessionDay)
    if (diff === 0) {
      streak++
      checkDate = new Date(checkDate.getTime() - 86400000)
    } else if (diff === 1) {
      streak++
      checkDate = sessionDay
    } else {
      break
    }
  }

  return streak
}
