import { useState, useEffect } from 'react'
import { getAIProvider } from '@/lib/ai/aiProvider'
import { buildFitnessContext } from '@/hooks/useFitnessContext'
import { renderInline } from '@/utils/renderMarkdown'

export function AIInsight() {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const ai = (() => {
    try { return getAIProvider() } catch { return null }
  })()

  const cacheKey = `ai_insight_${new Date().toDateString()}_${ai?.name ?? ''}`

  useEffect(() => {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) { setInsight(cached); return }
    fetchInsight()
  }, [])

  async function fetchInsight() {
    setLoading(true)
    try {
      const provider = getAIProvider()
      const context = await buildFitnessContext()
      const text = await provider.generateDailyInsight(context)
      setInsight(text)
      sessionStorage.setItem(cacheKey, text)
    } catch {
      setInsight(null)
    }
    setLoading(false)
  }

  if (!ai) return null

  return (
    <div className="mb-4">
      <div className="rounded-2xl border border-cyber-green/25 bg-gradient-to-br from-cyber-green/8 to-transparent overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
          <span className="text-[10px] font-mono text-cyber-green uppercase tracking-widest">Coach Insight</span>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          {loading ? (
            <div className="space-y-2 mb-3">
              <div className="h-3 bg-cyber-green/10 rounded-full animate-pulse w-full" />
              <div className="h-3 bg-cyber-green/10 rounded-full animate-pulse w-3/4" />
            </div>
          ) : insight ? (
            <p className="text-sm text-cyber-text leading-relaxed mb-3">{renderInline(insight)}</p>
          ) : (
            <p className="text-sm text-cyber-dim font-mono mb-3">Tap below to get today's insight.</p>
          )}

          <button
            onClick={fetchInsight}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-mono text-cyber-green/70 hover:text-cyber-green transition-colors disabled:opacity-40 border border-cyber-green/20 hover:border-cyber-green/40 px-3 py-1 rounded-lg"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
            <span>{loading ? 'thinking...' : 'Refresh insight'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
