import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-cyber-yellow/10 border-b border-cyber-yellow/40 px-4 py-2 flex items-center gap-2 text-cyber-yellow text-xs font-mono animate-fade-in">
      <span className="w-2 h-2 rounded-full bg-cyber-yellow animate-pulse-slow" />
      OFFLINE MODE — changes saved locally, will sync when connected
    </div>
  )
}
