import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { formatRoutineTime, getRoutineEventsForDay, ROUTINE_COLOR_CLASSES } from '@/data/routineSchedule'
import { db } from '@/db/db'
import type { RoutineItem } from '@/types'

const REMINDER_WINDOW_MINUTES = 5
const MISSED_REMINDER_WINDOW_MINUTES = 120
const SNOOZE_MINUTES = 10

interface ActiveReminder {
  event: RoutineItem
  missed: boolean
  scheduledLabel: string
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function eventMinutes(event: RoutineItem) {
  const [hours, minutes] = event.time.split(':').map(Number)
  return hours * 60 + minutes
}

function reminderOffset(event: RoutineItem) {
  return event.reminderOffsetMinutes ?? 0
}

function reminderStorageKey(event: RoutineItem, date: Date) {
  return `fitflow-reminder-${event.id}-${dateKey(date)}-${reminderOffset(event)}`
}

function doneStorageKey(event: RoutineItem, date: Date) {
  return `fitflow-reminder-done-${event.id}-${dateKey(date)}`
}

function snoozeStorageKey(event: RoutineItem, date: Date) {
  return `fitflow-reminder-snooze-${event.id}-${dateKey(date)}`
}

function reminderDueMinutes(event: RoutineItem) {
  return eventMinutes(event) - reminderOffset(event)
}

function reminderBody(event: RoutineItem, missed: boolean, scheduledLabel: string) {
  const prefix = missed ? `Missed ${scheduledLabel}.` : `${event.title} is scheduled ${scheduledLabel}.`
  return event.notes ? `${prefix} ${event.notes}` : prefix
}

async function maybeNotify(event: RoutineItem, missed: boolean, scheduledLabel: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const title = missed ? `Missed ${event.title}` : `${event.title} reminder`
  const body = reminderBody(event, missed, scheduledLabel)

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `fitflow-${event.id}-${dateKey(new Date())}`,
      })
      return
    }

    new Notification(title, { body, icon: '/icons/icon-192.png' })
  } catch {
    // Some mobile browsers only allow service-worker notifications.
  }
}

export function RoutineReminder() {
  const [activeReminder, setActiveReminder] = useState<ActiveReminder | null>(null)
  const routines = useLiveQuery(
    () => db.routineItems.filter((item) => !item.deletedAt).toArray(),
    []
  )

  useEffect(() => {
    if (!routines) return

    function checkReminder() {
      const now = new Date()
      const nowMinutes = minutesFromMidnight(now)
      const events = getRoutineEventsForDay(routines, now.getDay()).filter((event) => event.reminderEnabled !== false)

      for (const event of events) {
        const dueMinutes = reminderDueMinutes(event)
        const snoozedUntil = Number(localStorage.getItem(snoozeStorageKey(event, now)) ?? 0)
        const effectiveDueMinutes = Number.isFinite(snoozedUntil) && snoozedUntil > dueMinutes ? snoozedUntil : dueMinutes
        const minutesLate = nowMinutes - effectiveDueMinutes
        const isDue = minutesLate >= 0 && minutesLate < REMINDER_WINDOW_MINUTES
        const isMissed = minutesLate >= REMINDER_WINDOW_MINUTES && minutesLate <= MISSED_REMINDER_WINDOW_MINUTES
        const storageKey = reminderStorageKey(event, now)
        const doneKey = doneStorageKey(event, now)

        if ((isDue || isMissed) && localStorage.getItem(storageKey) !== 'shown' && localStorage.getItem(doneKey) !== 'done') {
          localStorage.setItem(storageKey, 'shown')
          const reminder = {
            event,
            missed: isMissed,
            scheduledLabel: reminderOffset(event) > 0 ? `${reminderOffset(event)} min before ${formatRoutineTime(event.time)}` : `at ${formatRoutineTime(event.time)}`,
          }
          setActiveReminder(reminder)
          void maybeNotify(event, isMissed, reminder.scheduledLabel)
          return
        }
      }
    }

    checkReminder()
    const interval = window.setInterval(checkReminder, 30_000)
    window.addEventListener('focus', checkReminder)
    document.addEventListener('visibilitychange', checkReminder)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', checkReminder)
      document.removeEventListener('visibilitychange', checkReminder)
    }
  }, [routines])

  if (!activeReminder) return null

  const { event: activeEvent } = activeReminder

  function dismissReminder(markDone: boolean) {
    if (markDone) {
      localStorage.setItem(doneStorageKey(activeEvent, new Date()), 'done')
    }
    setActiveReminder(null)
  }

  function snoozeReminder() {
    const now = new Date()
    localStorage.setItem(snoozeStorageKey(activeEvent, now), String(minutesFromMidnight(now) + SNOOZE_MINUTES))
    localStorage.removeItem(reminderStorageKey(activeEvent, now))
    setActiveReminder(null)
  }

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 animate-slide-up rounded-xl border border-cyber-green/40 bg-cyber-black/95 p-4 shadow-glow-green backdrop-blur">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border ${ROUTINE_COLOR_CLASSES[activeEvent.color]}`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-mono uppercase tracking-widest text-cyber-green">
            {activeReminder.missed ? `Missed ${activeReminder.scheduledLabel}` : activeReminder.scheduledLabel}
          </div>
          <div className="mt-1 text-base font-bold text-cyber-text">{activeEvent.title} time</div>
          {activeEvent.notes && <p className="mt-1 text-sm text-cyber-dim">{activeEvent.notes}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={snoozeReminder} className="btn-secondary flex-1 py-2 text-xs">
              Snooze 10 min
            </button>
            <button type="button" onClick={() => dismissReminder(true)} className="btn-primary flex-1 py-2 text-xs">
              Done
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dismissReminder(false)}
          className="rounded p-1.5 text-cyber-dim transition-colors hover:text-cyber-green"
          aria-label="Dismiss reminder"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
