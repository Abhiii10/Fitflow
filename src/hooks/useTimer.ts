import { useState, useEffect, useCallback, useRef } from 'react'

interface UseTimerOptions {
  onComplete?: () => void
  onTick?: (remaining: number) => void
}

export function useTimer(options: UseTimerOptions = {}) {
  const [endTime, setEndTime] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const rafRef = useRef<number>(0)
  const onCompleteRef = useRef(options.onComplete)
  const onTickRef = useRef(options.onTick)

  useEffect(() => {
    onCompleteRef.current = options.onComplete
    onTickRef.current = options.onTick
  })

  const tick = useCallback(() => {
    if (!endTime) return
    const now = Date.now()
    const rem = Math.max(0, Math.ceil((endTime - now) / 1000))
    setRemaining(rem)
    onTickRef.current?.(rem)

    if (rem <= 0) {
      setIsRunning(false)
      setEndTime(null)
      onCompleteRef.current?.()
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [endTime])

  useEffect(() => {
    if (isRunning && endTime) {
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isRunning, endTime, tick])

  const start = useCallback((seconds: number) => {
    const et = Date.now() + seconds * 1000
    setEndTime(et)
    setRemaining(seconds)
    setIsRunning(true)
  }, [])

  const startAt = useCallback((targetEndTime: number) => {
    const rem = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000))
    setEndTime(targetEndTime)
    setRemaining(rem)
    setIsRunning(rem > 0)
  }, [])

  const stop = useCallback(() => {
    setIsRunning(false)
    setEndTime(null)
    setRemaining(0)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const pause = useCallback(() => {
    setIsRunning(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  return { remaining, isRunning, start, startAt, stop, pause, endTime }
}
