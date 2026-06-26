import { useState, useEffect, useCallback } from 'react'
import { runCoach } from '@/coach/engine'
import type { CoachResult } from '@/coach/engine'

interface UseCoachReturn {
  result: CoachResult | null
  loading: boolean
  refresh: () => void
}

export function useCoach(): UseCoachReturn {
  const [result, setResult] = useState<CoachResult | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    runCoach()
      .then(setResult)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { result, loading, refresh }
}
