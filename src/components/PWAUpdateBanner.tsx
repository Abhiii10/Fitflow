import { useRegisterSW } from 'virtual:pwa-register/react'

export function PWAUpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      // Poll for updates every 10 minutes when online
      if (r) {
        setInterval(() => {
          if (navigator.onLine) r.update()
        }, 10 * 60 * 1000)
      }
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-3 bg-cyber-dark border-b border-cyber-green/30 shadow-lg animate-fade-in">
      <span className="text-xs font-mono text-cyber-green">
        New FitFlow update available. Unsynced local logs stay saved.
      </span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-cyber-green text-cyber-black font-mono text-xs font-bold hover:bg-cyber-green/90 transition-colors"
      >
        Reload
      </button>
    </div>
  )
}
