import { useStore } from '@/store/useStore'
import { useSync } from '@/hooks/useSync'
import type { SyncStatus } from '@/types'

const statusConfig: Record<SyncStatus, { label: string; color: string; dot: string }> = {
  synced: {
    label: 'Synced',
    color: 'text-cyber-green',
    dot: 'bg-cyber-green',
  },
  syncing: {
    label: 'Syncing',
    color: 'text-cyber-cyan',
    dot: 'bg-cyber-cyan animate-pulse',
  },
  pending: {
    label: 'Pending',
    color: 'text-yellow-400',
    dot: 'bg-yellow-400 animate-pulse',
  },
  offline: {
    label: 'Offline',
    color: 'text-cyber-dim',
    dot: 'bg-cyber-dim',
  },
  error: {
    label: 'Error',
    color: 'text-red-400',
    dot: 'bg-red-400',
  },
}

export function SyncStatusBadge() {
  const { syncStatus, pendingCount } = useStore()
  const { runSync } = useSync()
  const cfg = statusConfig[syncStatus]

  return (
    <button
      onClick={runSync}
      className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border border-cyber-border bg-cyber-panel hover:bg-cyber-card transition-colors ${cfg.color}`}
      title={pendingCount > 0 ? `${pendingCount} pending — tap to sync` : cfg.label}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
      {pendingCount > 0 && syncStatus !== 'syncing' && (
        <span className="ml-0.5 text-cyber-dim">({pendingCount})</span>
      )}
    </button>
  )
}
