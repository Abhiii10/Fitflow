import { useEffect, useRef } from 'react'

export function useWaterReminder(waterTotal: number, waterGoal: number, enabled = true) {
  const lastReminderRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!enabled) return
    if (!('Notification' in window)) return

    // Request permission once
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const interval = setInterval(() => {
      if (Notification.permission !== 'granted') return
      const now = Date.now()
      const twoHours = 2 * 3600 * 1000
      const pct = waterTotal / waterGoal
      if (pct < 0.9 && now - lastReminderRef.current >= twoHours) {
        lastReminderRef.current = now
        const remaining = Math.round(waterGoal - waterTotal)
        new Notification('💧 FitFlow Hydration Reminder', {
          body: `${remaining}ml to go — stay hydrated!`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
        })
      }
    }, 60 * 1000) // check every minute

    return () => clearInterval(interval)
  }, [waterTotal, waterGoal, enabled])
}
