import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, format, getDaysInMonth, startOfMonth } from 'date-fns'
import NepaliDate from 'nepali-date-converter'
import { db } from '@/db/db'
import { formatRoutineTime, getRoutineEventsForDay, ROUTINE_COLOR_CLASSES } from '@/data/routineSchedule'
import { generateId } from '@/utils/id'
import type { RoutineItem } from '@/types'

const DAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

const COLOR_OPTIONS: RoutineItem['color'][] = ['green', 'cyan', 'yellow', 'red', 'purple']
const REMINDER_OFFSET_OPTIONS = [0, 5, 10, 15, 30]

interface RoutineFormState {
  id?: string
  title: string
  time: string
  dayNumbers: number[]
  color: RoutineItem['color']
  notes: string
  enabled: boolean
  reminderEnabled: boolean
  reminderOffsetMinutes: number
}

function emptyForm(): RoutineFormState {
  return {
    title: '',
    time: '13:00',
    dayNumbers: [0, 1, 2, 3, 4, 5],
    color: 'green',
    notes: '',
    enabled: true,
    reminderEnabled: true,
    reminderOffsetMinutes: 0,
  }
}

function formFromRoutine(item: RoutineItem): RoutineFormState {
  return {
    id: item.id,
    title: item.title,
    time: item.time,
    dayNumbers: item.dayNumbers,
    color: item.color,
    notes: item.notes ?? '',
    enabled: item.enabled,
    reminderEnabled: item.reminderEnabled !== false,
    reminderOffsetMinutes: item.reminderOffsetMinutes ?? 0,
  }
}

function formatBS(date: Date) {
  return new NepaliDate(date).format('ddd, DD MMMM YYYY')
}

function getBSDate(date: Date): { date: number; month: string; year: number } | null {
  try {
    const nd = new NepaliDate(date)
    return { date: nd.getDate(), month: nd.format('MMMM'), year: nd.getYear() }
  } catch {
    return null
  }
}

function requestNotifications() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    void Notification.requestPermission()
  }
}

function reminderOffsetLabel(minutes: number) {
  return minutes === 0 ? 'At time' : `${minutes} min before`
}

function isStandaloneApp() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  )
}

async function saveRoutine(form: RoutineFormState) {
  const now = Date.now()
  const record: RoutineItem = {
    id: form.id ?? generateId(),
    title: form.title.trim(),
    time: form.time,
    dayNumbers: [...form.dayNumbers].sort((a, b) => a - b),
    color: form.color,
    notes: form.notes.trim() || undefined,
    enabled: form.enabled,
    reminderEnabled: form.reminderEnabled,
    reminderOffsetMinutes: form.reminderOffsetMinutes,
    updatedAt: now,
    pendingSync: true,
    syncStatus: 'pending',
  }

  await db.routineItems.put(record)
}

async function deleteRoutine(id: string) {
  await db.routineItems.update(id, {
    deletedAt: Date.now(),
    updatedAt: Date.now(),
    pendingSync: true,
    syncStatus: 'pending',
  })
}

export function Calendar() {
  const [form, setForm] = useState<RoutineFormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const routines = useLiveQuery(
    () => db.routineItems.filter((item) => !item.deletedAt).toArray(),
    []
  )

  const today = new Date()
  const currentDay = today.getDay()
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(today, index)
        return {
          date,
          dayNumber: date.getDay(),
          isToday: index === 0,
          events: getRoutineEventsForDay(routines, date.getDay()),
        }
      }),
    [routines]
  )
  const todaysEvents = getRoutineEventsForDay(routines, currentDay)

  const monthGridDays = useMemo(() => {
    const firstDay = startOfMonth(viewDate)
    const startPad = firstDay.getDay()
    const totalDays = getDaysInMonth(viewDate)
    const cells: (Date | null)[] = []
    for (let i = 0; i < startPad; i++) cells.push(null)
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), d))
    const rem = (7 - (cells.length % 7)) % 7
    for (let i = 0; i < rem; i++) cells.push(null)
    return cells
  }, [viewDate])

  const bsViewHeader = getBSDate(viewDate)

  const notificationsSupported = 'Notification' in window
  const notificationStatus = notificationsSupported ? Notification.permission : 'unsupported'
  const installedStatus = isStandaloneApp()

  useEffect(() => {
    setError(null)
  }, [form])

  async function handleSave() {
    if (!form) return
    if (!form.title.trim()) {
      setError('Routine name is required.')
      return
    }
    if (form.dayNumbers.length === 0) {
      setError('Pick at least one day.')
      return
    }

    await saveRoutine(form)
    setForm(null)
  }

  return (
    <div className="page-container">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-mono font-bold text-cyber-green tracking-tight">Routines</h1>
          <p className="text-xs text-cyber-dim font-mono">AD + BS calendar &amp; routine reminders</p>
        </div>
        <button type="button" onClick={() => setForm(emptyForm())} className="btn-primary">
          Add
        </button>
      </div>

      {/* Month Calendar Grid */}
      <div className="mb-4 card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="rounded-lg border border-cyber-border px-3 py-1.5 font-mono text-sm text-cyber-dim hover:text-cyber-green hover:border-cyber-green/40 transition-colors"
          >
            ‹
          </button>
          <div className="text-center">
            <div className="font-mono text-sm font-bold text-cyber-text">{format(viewDate, 'MMMM yyyy')}</div>
            {bsViewHeader && (
              <div className="font-mono text-[11px] text-cyber-cyan">{bsViewHeader.month} {bsViewHeader.year} BS</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="rounded-lg border border-cyber-border px-3 py-1.5 font-mono text-sm text-cyber-dim hover:text-cyber-green hover:border-cyber-green/40 transition-colors"
          >
            ›
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
            <div key={d} className="py-1 text-center font-mono text-[10px] text-cyber-dim">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {monthGridDays.map((day, idx) => {
            if (!day) return <div key={idx} className="aspect-square" />
            const todayStr = format(today, 'yyyy-MM-dd')
            const dayStr = format(day, 'yyyy-MM-dd')
            const isToday = dayStr === todayStr
            const isPast = dayStr < todayStr
            const bs = getBSDate(day)
            const hasRoutine = getRoutineEventsForDay(routines, day.getDay()).length > 0
            return (
              <div
                key={idx}
                className={`flex flex-col items-center justify-center rounded-lg py-1 ${
                  isToday
                    ? 'border border-cyber-green/50 bg-cyber-green/10'
                    : 'border border-transparent'
                } ${isPast ? 'opacity-30' : ''}`}
              >
                <span className={`font-mono text-xs font-bold leading-none ${isToday ? 'text-cyber-green' : isPast ? 'text-cyber-dim' : 'text-cyber-text'}`}>
                  {day.getDate()}
                </span>
                {bs && (
                  <span className={`mt-0.5 font-mono text-[9px] leading-none ${isPast ? 'text-cyber-dim' : 'text-cyber-cyan'}`}>{bs.date}</span>
                )}
                {hasRoutine && !isPast && (
                  <span className="mt-0.5 h-0.5 w-3 rounded-full bg-cyber-green/50" />
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-cyber-dim">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded-full bg-cyber-green/50" /> routine day</span>
          <span className="text-cyber-cyan">bottom = BS date</span>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-cyber-green/30 bg-cyber-green/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-cyber-green">Today</div>
            <div className="mt-1 text-lg font-mono font-bold text-cyber-text">{format(today, 'EEEE')}</div>
            <div className="mt-1 text-xs font-mono text-cyber-dim">AD {format(today, 'MMM d, yyyy')}</div>
            <div className="text-xs font-mono text-cyber-cyan">BS {formatBS(today)}</div>
          </div>
          <span className="text-[10px] font-mono text-cyber-dim">
            {todaysEvents.length > 0 ? `${todaysEvents.length} routines` : 'rest'}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {todaysEvents.length > 0 ? (
            todaysEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setForm(formFromRoutine(event))}
                className={`w-full rounded-lg border px-3 py-2 text-left ${ROUTINE_COLOR_CLASSES[event.color]}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold">{event.title}</span>
                  <span className="font-mono text-sm">{formatRoutineTime(event.time)}</span>
                </div>
                <div className="mt-1 text-[11px] font-mono text-cyber-dim">
                  {event.reminderEnabled === false ? 'Reminder off' : reminderOffsetLabel(event.reminderOffsetMinutes ?? 0)}
                </div>
                {event.notes && <p className="mt-1 text-xs text-cyber-dim">{event.notes}</p>}
              </button>
            ))
          ) : (
            <div className="rounded-lg border border-cyber-border bg-cyber-black/30 px-3 py-3 text-sm text-cyber-dim">
              No fixed routine today.
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="section-title">Next 7 Days</h2>
        <div className="space-y-2">
          {days.map((day) => (
            <div
              key={day.date.toISOString()}
              className={`rounded-xl border p-3 ${
                day.isToday ? 'border-cyber-green/40 bg-cyber-green/5' : 'border-cyber-border bg-cyber-card'
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className={`font-mono text-sm font-bold ${day.isToday ? 'text-cyber-green' : 'text-cyber-text'}`}>
                    {format(day.date, 'EEEE')}
                  </div>
                  <div className="text-[11px] font-mono text-cyber-dim">AD {format(day.date, 'MMM d')}</div>
                  <div className="text-[11px] font-mono text-cyber-cyan">BS {formatBS(day.date)}</div>
                </div>
                <span className="text-[10px] font-mono text-cyber-dim">
                  {day.events.length > 0 ? `${day.events.length} events` : 'rest'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {day.events.length > 0 ? (
                  day.events.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setForm(formFromRoutine(event))}
                      className={`rounded-lg border px-2 py-2 text-left ${ROUTINE_COLOR_CLASSES[event.color]}`}
                    >
                      <div className="text-xs font-mono font-bold">{formatRoutineTime(event.time)}</div>
                      <div className="truncate text-sm font-semibold text-cyber-text">{event.title}</div>
                      <div className="mt-1 truncate text-[10px] font-mono text-cyber-dim">
                        {event.reminderEnabled === false ? 'Reminder off' : reminderOffsetLabel(event.reminderOffsetMinutes ?? 0)}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="col-span-2 rounded-lg border border-cyber-border bg-cyber-black/30 px-2 py-3 text-center text-xs font-mono text-cyber-dim">
                    Rest
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Routines</h2>
        <div className="space-y-2">
          {(routines ?? []).map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setForm(formFromRoutine(event))}
              className="flex w-full items-center justify-between rounded-lg border border-cyber-border bg-cyber-black/30 px-3 py-2 text-left"
            >
              <span className="text-sm text-cyber-text">{event.title}</span>
              <span className="text-right text-xs font-mono text-cyber-green">
                {formatRoutineTime(event.time)}
                <span className="block text-[10px] text-cyber-dim">
                  {event.reminderEnabled === false ? 'Reminder off' : reminderOffsetLabel(event.reminderOffsetMinutes ?? 0)}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-cyber-border bg-cyber-black/30 px-3 py-3 text-xs text-cyber-dim">
          <div className="flex items-center justify-between gap-3 font-mono">
            <span>Notifications</span>
            <span className={notificationStatus === 'granted' ? 'text-cyber-green' : notificationStatus === 'denied' ? 'text-yellow-400' : 'text-cyber-cyan'}>
              {notificationStatus}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 font-mono">
            <span>Home Screen app</span>
            <span className={installedStatus ? 'text-cyber-green' : 'text-yellow-400'}>{installedStatus ? 'Yes' : 'No'}</span>
          </div>
          <p className="mt-3">
            FitFlow catches missed reminders when you reopen it. For native phone alarms, set them up directly in Google Calendar.
          </p>
        </div>
        {notificationsSupported && notificationStatus !== 'granted' && (
          <button type="button" onClick={requestNotifications} className="btn-secondary mt-3 w-full">
            Enable phone notifications
          </button>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/80 px-3 pb-3 pt-8 sm:items-center sm:justify-center">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-cyber-border bg-cyber-black p-4 shadow-glow-green">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-base font-bold text-cyber-green">
                {form.id ? 'Edit Routine' : 'Add Routine'}
              </h2>
              <button type="button" onClick={() => setForm(null)} className="rounded p-2 text-cyber-dim hover:text-cyber-green" aria-label="Close">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <label className="form-label">Name</label>
            <input
              className="input-field mb-3"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Creatine, Gym, Meal prep..."
            />

            <label className="form-label">Time</label>
            <input
              className="input-field mb-3"
              type="time"
              value={form.time}
              onChange={(event) => setForm({ ...form, time: event.target.value })}
            />

            <label className="form-label">Days</label>
            <div className="mb-3 grid grid-cols-7 gap-1">
              {DAY_OPTIONS.map((day) => {
                const selected = form.dayNumbers.includes(day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        dayNumbers: selected
                          ? form.dayNumbers.filter((value) => value !== day.value)
                          : [...form.dayNumbers, day.value],
                      })
                    }}
                    className={`rounded-lg border py-2 text-[10px] font-mono ${
                      selected ? 'border-cyber-green bg-cyber-green/10 text-cyber-green' : 'border-cyber-border text-cyber-dim'
                    }`}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>

            <label className="form-label">Color</label>
            <div className="mb-3 grid grid-cols-5 gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className={`rounded-lg border py-2 text-[10px] font-mono ${ROUTINE_COLOR_CLASSES[color]} ${
                    form.color === color ? 'ring-1 ring-current' : ''
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>

            <label className="form-label">Notes</label>
            <textarea
              className="input-field mb-3 min-h-20 resize-none"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Optional note..."
            />

            <label className="mb-4 flex items-center justify-between rounded-lg border border-cyber-border bg-cyber-black/30 px-3 py-2">
              <span className="text-sm text-cyber-text">Enabled</span>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
                className="h-5 w-5 accent-cyber-green"
              />
            </label>

            <label className="mb-3 flex items-center justify-between rounded-lg border border-cyber-border bg-cyber-black/30 px-3 py-2">
              <span className="text-sm text-cyber-text">Reminder</span>
              <input
                type="checkbox"
                checked={form.reminderEnabled}
                onChange={(event) => setForm({ ...form, reminderEnabled: event.target.checked })}
                className="h-5 w-5 accent-cyber-green"
              />
            </label>

            {form.reminderEnabled && (
              <>
                <label className="form-label">Notify</label>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {REMINDER_OFFSET_OPTIONS.map((offset) => (
                    <button
                      key={offset}
                      type="button"
                      onClick={() => setForm({ ...form, reminderOffsetMinutes: offset })}
                      className={`rounded-lg border px-2 py-2 text-xs font-mono ${
                        form.reminderOffsetMinutes === offset
                          ? 'border-cyber-green bg-cyber-green/10 text-cyber-green'
                          : 'border-cyber-border text-cyber-dim'
                      }`}
                    >
                      {reminderOffsetLabel(offset)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {error && <div className="mb-3 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-400">{error}</div>}

            <div className="flex gap-2">
              {form.id && (
                <button
                  type="button"
                  onClick={async () => {
                    await deleteRoutine(form.id!)
                    setForm(null)
                  }}
                  className="btn-secondary flex-1 text-red-400 hover:text-red-400"
                >
                  Delete
                </button>
              )}
              <button type="button" onClick={handleSave} className="btn-primary flex-1">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
