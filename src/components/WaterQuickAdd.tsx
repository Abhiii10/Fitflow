import { useState } from 'react'
import { db } from '@/db/db'
import { generateId } from '@/utils/id'
import { todayStr } from '@/utils/date'
import { useStore } from '@/store/useStore'

const QUICK_AMOUNTS = [150, 250, 500]

interface WaterQuickAddProps {
  onAdded?: () => void
}

export function WaterQuickAdd({ onAdded }: WaterQuickAddProps) {
  const [customAmount, setCustomAmount] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const { setSyncStatus } = useStore()

  async function addWater(amount: number) {
    if (amount <= 0) return
    const now = Date.now()
    await db.waterLogs.add({
      id: generateId(),
      amountMl: amount,
      loggedAt: now,
      date: todayStr(),
      updatedAt: now,
      pendingSync: true,
      syncStatus: 'pending',
    })
    setSyncStatus('pending')
    onAdded?.()
  }

  async function handleCustomAdd() {
    const amount = parseInt(customAmount, 10)
    if (!isNaN(amount) && amount > 0) {
      await addWater(amount)
      setCustomAmount('')
      setShowCustom(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {QUICK_AMOUNTS.map((amount) => (
          <button
            key={amount}
            onClick={() => addWater(amount)}
            className="flex-1 py-3 rounded-lg border border-cyber-border bg-cyber-card text-cyber-green font-mono text-sm font-semibold hover:border-cyber-green/50 hover:bg-cyber-green/5 hover:shadow-glow-sm transition-all active:scale-95"
          >
            +{amount}ml
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="px-3 py-3 rounded-lg border border-cyber-border bg-cyber-card text-cyber-dim font-mono text-sm hover:border-cyber-cyan/50 hover:text-cyber-cyan transition-all"
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex gap-2 animate-fade-in">
          <input
            type="number"
            min="1"
            max="3000"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomAdd()}
            placeholder="Amount in ml"
            className="flex-1 px-3 py-2 bg-cyber-dark border border-cyber-border rounded-lg text-cyber-text font-mono text-sm focus:outline-none focus:border-cyber-cyan/60 placeholder-cyber-muted"
          />
          <button
            onClick={handleCustomAdd}
            className="px-4 py-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/40 text-cyber-cyan font-mono text-sm font-semibold hover:bg-cyber-cyan/20 transition-colors"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
