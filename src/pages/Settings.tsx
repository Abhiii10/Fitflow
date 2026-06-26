import { useState, useEffect } from 'react'
import { db, updateProfile } from '@/db/db'
import { useStore } from '@/store/useStore'
import { useSync } from '@/hooks/useSync'
import { getAIProvider } from '@/lib/ai/aiProvider'
import { SignInCard } from '@/components/auth/SignInCard'
import { UserProfileCard } from '@/components/auth/UserProfileCard'
import { isConfigured } from '@/firebase/config'
import {
  getConfiguredAuthDomain,
  isIOS,
  isStandalonePWA,
  isIOSStandalonePWA,
  signInWithGoogle,
} from '@/lib/auth/authService'
import { format } from 'date-fns'
import { getBackupTables, SCHEMA_VERSION } from '@/data/tableRegistry'
import type { Profile, GoalMode } from '@/types'

// ─── Backup format ────────────────────────────────────────────────────────────

interface BackupManifest {
  version: string
  schemaVersion: number
  exportedAt: string
  tables: Record<string, { count: number; records: unknown[] }>
}

const APP_VERSION = __APP_VERSION__

async function exportBackup(): Promise<BackupManifest> {
  const tables: BackupManifest['tables'] = {}
  for (const entry of getBackupTables()) {
    const records = await entry.getTable().toArray()
    tables[entry.exportKey] = { count: records.length, records }
  }
  return {
    version: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  }
}

async function importBackup(manifest: BackupManifest): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = []
  let imported = 0

  // Basic validation
  if (!manifest.tables || typeof manifest.tables !== 'object') {
    throw new Error('Invalid backup format: missing tables object.')
  }

  // Validate records against registry validators
  for (const entry of getBackupTables()) {
    const tableData = manifest.tables[entry.exportKey]
    if (!tableData) continue
    if (!Array.isArray(tableData.records)) {
      errors.push(`${entry.name}: records is not an array`)
      continue
    }
    for (let i = 0; i < tableData.records.length; i++) {
      if (!entry.validate(tableData.records[i])) {
        errors.push(`${entry.name}[${i}]: failed validation`)
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Backup validation failed:\n${errors.join('\n')}`)
  }

  // Write all tables in a single Dexie transaction per table
  for (const entry of getBackupTables()) {
    const tableData = manifest.tables[entry.exportKey]
    if (!tableData || !Array.isArray(tableData.records) || tableData.records.length === 0) continue
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await entry.getTable().bulkPut(tableData.records as any[])
      imported += tableData.records.length
    } catch (err) {
      errors.push(`${entry.name}: ${err instanceof Error ? err.message : 'write failed'}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`Import partially failed:\n${errors.join('\n')}`)
  }

  return { imported, errors }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

interface StorageInfo {
  usageMb: number
  quotaMb: number
  pct: number
  persisted: boolean
}

async function getStorageInfo(): Promise<StorageInfo | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const est = await navigator.storage.estimate()
    const usage = est.usage ?? 0
    const quota = est.quota ?? 1
    const persisted = navigator.storage.persist != null ? await navigator.storage.persisted() : false
    return {
      usageMb: Math.round(usage / 1024 / 1024 * 10) / 10,
      quotaMb: Math.round(quota / 1024 / 1024),
      pct: Math.round((usage / quota) * 100),
      persisted,
    }
  } catch {
    return null
  }
}

async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  return navigator.storage.persist()
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Settings() {
  const {
    profile,
    setProfile,
    authUser,
    syncStatus,
    syncError,
    pendingCount,
    lastSyncedAt,
    lastSyncAttemptAt,
    lastRestoredAt,
    syncFailures,
    lastAuthError,
    setLastAuthError,
  } = useStore()
  const { runSync } = useSync()
  const standalone = isStandalonePWA()
  const ios = isIOS()
  const iosPwa = isIOSStandalonePWA()
  const failedSyncCount = syncFailures.reduce((sum, f) => sum + f.count, 0)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showSystemCheck, setShowSystemCheck] = useState(false)
  const [retryingAuth, setRetryingAuth] = useState(false)
  const [retryAuthMsg, setRetryAuthMsg] = useState('')
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)

  // Goals state
  const [waterGoal, setWaterGoal] = useState(String(profile?.waterGoalMl ?? 3500))
  const [proteinMin, setProteinMin] = useState(String(profile?.proteinGoalMinG ?? 140))
  const [proteinMax, setProteinMax] = useState(String(profile?.proteinGoalMaxG ?? 160))
  const [calorieTarget, setCalorieTarget] = useState(String(profile?.calorieTarget ?? ''))
  const [stepsMin, setStepsMin] = useState(String(profile?.stepsGoalMin ?? 8000))
  const [stepsMax, setStepsMax] = useState(String(profile?.stepsGoalMax ?? 12000))
  const [sleepMin, setSleepMin] = useState(String(profile?.sleepGoalMinH ?? 7))
  const [sleepMax, setSleepMax] = useState(String(profile?.sleepGoalMaxH ?? 9))
  const [restSeconds, setRestSeconds] = useState(String(profile?.defaultRestSeconds ?? 90))
  const [soundEnabled, setSoundEnabled] = useState(profile?.timerSoundEnabled ?? true)
  const [vibrationEnabled, setVibrationEnabled] = useState(profile?.vibrationEnabled ?? true)
  const [workoutDays, setWorkoutDays] = useState(String(profile?.workoutDaysPerWeek ?? 4))
  const [goalMode, setGoalMode] = useState<GoalMode>(profile?.goalMode ?? 'cut')
  const [currentWeight, setCurrentWeight] = useState(String(profile?.currentWeightKg ?? ''))
  const [targetWeight, setTargetWeight] = useState(String(profile?.targetWeightKg ?? ''))
  const [heightCm, setHeightCm] = useState(String(profile?.heightCm ?? ''))

  const aiProvider = (() => {
    try { return getAIProvider() } catch { return null }
  })()

  useEffect(() => {
    getStorageInfo().then(setStorageInfo)
    const key = 'fitflow_last_backup'
    try { setLastBackupAt(localStorage.getItem(key)) } catch { /* ignore */ }
  }, [])

  async function handleSave() {
    setSaving(true)
    const updates: Partial<Omit<Profile, 'id'>> = {
      waterGoalMl: parseInt(waterGoal) || 3500,
      proteinGoalMinG: parseInt(proteinMin) || 140,
      proteinGoalMaxG: parseInt(proteinMax) || 160,
      calorieTarget: calorieTarget ? parseInt(calorieTarget) : undefined,
      stepsGoalMin: parseInt(stepsMin) || 8000,
      stepsGoalMax: parseInt(stepsMax) || 12000,
      sleepGoalMinH: parseFloat(sleepMin) || 7,
      sleepGoalMaxH: parseFloat(sleepMax) || 9,
      defaultRestSeconds: parseInt(restSeconds) || 90,
      timerSoundEnabled: soundEnabled,
      vibrationEnabled,
      workoutDaysPerWeek: parseInt(workoutDays) || 4,
      goalMode,
      currentWeightKg: currentWeight ? parseFloat(currentWeight) : undefined,
      targetWeightKg: targetWeight ? parseFloat(targetWeight) : undefined,
      heightCm: heightCm ? parseFloat(heightCm) : undefined,
    }
    await updateProfile(updates)
    const updated = await db.profile.get('default')
    if (updated) setProfile(updated)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSyncNow() {
    setSyncing(true)
    await runSync()
    setSyncing(false)
  }

  async function handleRetryAuth() {
    setRetryingAuth(true)
    setRetryAuthMsg('')
    setLastAuthError(null)
    try {
      const result = await signInWithGoogle()
      if (result.status === 'redirect_initiated') {
        setRetryAuthMsg('Redirecting to Google...')
      } else if (result.status === 'open_safari') {
        setRetryAuthMsg('Open the app in Safari to sign in, then return here.')
        window.location.href = result.url
      } else if (result.status === 'error') {
        setLastAuthError(result.message)
      }
    } catch (e) {
      setLastAuthError(e instanceof Error ? e.message : 'Sign-in failed')
    }
    setRetryingAuth(false)
  }

  async function handleExport() {
    setExportStatus('Preparing backup...')
    try {
      const manifest = await exportBackup()
      const json = JSON.stringify(manifest, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fitflow-backup-${manifest.exportedAt.slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      const now = new Date().toISOString()
      try { localStorage.setItem('fitflow_last_backup', now) } catch { /* ignore */ }
      setLastBackupAt(now)
      const totalRecords = Object.values(manifest.tables).reduce((s, t) => s + t.count, 0)
      setExportStatus(`Backup saved — ${totalRecords} records exported.`)
      setTimeout(() => setExportStatus(null), 5000)
    } catch (err) {
      setExportStatus(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportStatus('Validating backup...')

    try {
      const text = await file.text()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let raw: any
      try {
        raw = JSON.parse(text)
      } catch {
        throw new Error('File is not valid JSON.')
      }

      // Detect legacy backup format (pre-registry)
      if (!raw.tables && !raw.version) {
        setImportStatus('Legacy backup detected. Importing compatible tables...')
        await importLegacy(raw)
        setImportStatus('Legacy import complete.')
        setTimeout(() => setImportStatus(null), 4000)
        setImporting(false)
        return
      }

      // Emergency pre-import backup
      setImportStatus('Creating pre-import safety backup...')
      const safetyManifest = await exportBackup()
      const safetyJson = JSON.stringify(safetyManifest)
      const safetyBlob = new Blob([safetyJson], { type: 'application/json' })
      const safetyUrl = URL.createObjectURL(safetyBlob)
      const safetyA = document.createElement('a')
      safetyA.href = safetyUrl
      safetyA.download = `fitflow-pre-import-safety-${new Date().toISOString().slice(0, 10)}.json`
      safetyA.click()
      URL.revokeObjectURL(safetyUrl)

      setImportStatus('Importing data...')
      const manifest = raw as BackupManifest
      const { imported } = await importBackup(manifest)
      setImportStatus(`Import complete — ${imported} records restored.`)
      setTimeout(() => setImportStatus(null), 5000)

      // Refresh profile in store
      const updated = await db.profile.get('default')
      if (updated) setProfile(updated)
    } catch (err) {
      setImportStatus(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
    setImporting(false)
  }

  // Handle old-format exports from before the registry refactor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function importLegacy(data: any) {
    if (data.water) await db.waterLogs.bulkPut(data.water)
    if (data.protein) await db.proteinLogs.bulkPut(data.protein)
    if (data.steps) await db.stepLogs.bulkPut(data.steps)
    if (data.sleep) await db.sleepLogs.bulkPut(data.sleep)
    if (data.plans) await db.workoutPlans.bulkPut(data.plans)
    if (data.exercises) await db.exercises.bulkPut(data.exercises)
    if (data.sessions) await db.workoutSessions.bulkPut(data.sessions)
    if (data.logs) await db.sessionExerciseLogs.bulkPut(data.logs)
    if (data.checkIns) await db.weeklyCheckIns.bulkPut(data.checkIns)
  }

  async function handleClearAll() {
    const ok = window.confirm(
      'This will delete ALL local data. This cannot be undone.\n\n' +
      'Export a backup first if you want to keep your data.'
    )
    if (!ok) return

    // Clear every table except local-only internal tables
    await Promise.all([
      db.profile.clear(),
      db.waterLogs.clear(),
      db.proteinLogs.clear(),
      db.macroLogs.clear(),
      db.stepLogs.clear(),
      db.cardioLogs.clear(),
      db.sleepLogs.clear(),
      db.weightLogs.clear(),
      db.photoLogs.clear(),
      db.workoutPlans.clear(),
      db.exercises.clear(),
      db.workoutSessions.clear(),
      db.sessionExerciseLogs.clear(),
      db.weeklyCheckIns.clear(),
      db.routineItems.clear(),
      db.aiGeneratedDrafts.clear(),
      db.activeSession.clear(),
      db.syncQueue.clear(),
    ])
    window.location.reload()
  }

  async function handleRequestPersistence() {
    const granted = await requestPersistence()
    if (granted) {
      const info = await getStorageInfo()
      setStorageInfo(info)
    } else {
      alert('Browser denied persistent storage. Data may be cleared by the OS under storage pressure.')
    }
  }

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-cyber-green' : 'bg-cyber-border'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-6' : ''}`} />
    </button>
  )

  const Row = ({ label, value, color = 'text-cyber-text' }: { label: string; value: string; color?: string }) => (
    <div className="flex items-center justify-between text-xs font-mono">
      <span className="text-cyber-dim">{label}</span>
      <span className={color}>{value}</span>
    </div>
  )

  const GOAL_MODES: { value: GoalMode; label: string }[] = [
    { value: 'cut', label: 'Cut (fat loss)' },
    { value: 'maintain', label: 'Maintain' },
    { value: 'lean-bulk', label: 'Lean Bulk' },
  ]

  return (
    <div className="page-container">
      <h1 className="page-title mb-5">Settings</h1>

      {/* ── Auth ─────────────────────────────────────────────────────────── */}
      <div className="mb-4">
        {authUser ? <UserProfileCard /> : <SignInCard />}
      </div>

      {/* ── System Check ─────────────────────────────────────────────────── */}
      <div className="card mb-4">
        <button
          onClick={() => setShowSystemCheck(!showSystemCheck)}
          className="flex items-center justify-between w-full"
        >
          <span className="text-xs font-mono text-cyber-dim uppercase tracking-widest">System Check</span>
          <svg className={`w-4 h-4 text-cyber-dim transition-transform ${showSystemCheck ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showSystemCheck && (
          <div className="mt-3 space-y-2 pt-3 border-t border-cyber-border/50">

            {/* Auth */}
            <div className="text-[10px] font-mono uppercase tracking-widest text-cyber-dim/60 pt-1">Auth</div>
            <Row label="Provider" value={authUser?.providerId ?? (authUser ? 'password' : 'none')} color={authUser ? 'text-cyber-green' : 'text-yellow-400'} />
            <Row label="UID" value={authUser ? authUser.uid.slice(0, 20) + '…' : '—'} color="text-cyber-dim" />
            <Row label="Email" value={authUser?.email ?? '—'} color={authUser?.email ? 'text-cyber-text' : 'text-cyber-dim'} />
            <Row label="Auth domain" value={getConfiguredAuthDomain()} color="text-cyber-dim" />
            <Row label="iOS" value={ios ? 'Yes' : 'No'} color={ios ? 'text-cyber-text' : 'text-cyber-dim'} />
            <Row label="Standalone PWA" value={standalone ? 'Yes (Home Screen)' : 'No (Browser)'} color={standalone ? 'text-cyber-green' : 'text-cyber-dim'} />
            <Row label="iOS standalone" value={iosPwa ? 'Yes — use Safari to sign in' : 'No'} color={iosPwa ? 'text-yellow-400' : 'text-cyber-dim'} />

            {lastAuthError && (
              <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-2 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-red-400">Auth error</div>
                <div className="text-xs font-mono text-red-300 break-words">{lastAuthError}</div>
                <button onClick={handleRetryAuth} disabled={retryingAuth} className="mt-1 w-full py-1.5 rounded border border-red-400/40 text-red-400 font-mono text-xs hover:bg-red-400/5 disabled:opacity-40">
                  {retryingAuth ? 'Retrying...' : 'Retry Sign-In'}
                </button>
              </div>
            )}
            {retryAuthMsg && <div className="text-xs font-mono text-cyber-cyan">{retryAuthMsg}</div>}
            {!authUser && !lastAuthError && (
              <button onClick={handleRetryAuth} disabled={retryingAuth} className="w-full py-1.5 rounded border border-cyber-green/30 text-cyber-green font-mono text-xs hover:bg-cyber-green/5 disabled:opacity-40">
                {retryingAuth ? 'Opening sign-in...' : 'Retry Google Sign-In'}
              </button>
            )}

            {/* Network & Local */}
            <div className="text-[10px] font-mono uppercase tracking-widest text-cyber-dim/60 pt-2">Data</div>
            <Row label="Network" value={navigator.onLine ? 'Online' : 'Offline'} color={navigator.onLine ? 'text-cyber-green' : 'text-cyber-dim'} />
            <Row label="Local DB" value={db.isOpen() ? 'Open (v8)' : 'Closed'} color={db.isOpen() ? 'text-cyber-green' : 'text-red-400'} />
            <Row label="Firestore" value={isConfigured ? 'Configured' : 'Not configured'} color={isConfigured ? 'text-cyber-green' : 'text-yellow-400'} />
            <Row label="AI coach" value={aiProvider?.name ?? 'Mock (no worker)'} color={aiProvider?.isMock === false ? 'text-cyber-green' : 'text-yellow-400'} />
            {storageInfo && (
              <>
                <Row label="Storage used" value={`${storageInfo.usageMb} MB / ~${storageInfo.quotaMb} MB (${storageInfo.pct}%)`} color="text-cyber-dim" />
                <Row label="Persistent" value={storageInfo.persisted ? 'Yes' : 'No'} color={storageInfo.persisted ? 'text-cyber-green' : 'text-yellow-400'} />
                {!storageInfo.persisted && (
                  <button onClick={handleRequestPersistence} className="w-full py-1.5 rounded border border-yellow-400/40 text-yellow-400 font-mono text-xs hover:bg-yellow-400/5">
                    Request Persistent Storage
                  </button>
                )}
              </>
            )}
            <Row label="Last backup" value={lastBackupAt ? format(new Date(lastBackupAt), 'MMM d, h:mm a') : 'Never'} color={lastBackupAt ? 'text-cyber-text' : 'text-red-400'} />

            {/* Sync */}
            <div className="text-[10px] font-mono uppercase tracking-widest text-cyber-dim/60 pt-2">Sync</div>
            <Row label="Status" value={syncStatus} color={syncStatus === 'synced' ? 'text-cyber-green' : syncStatus === 'error' ? 'text-red-400' : 'text-yellow-400'} />
            <Row label="Pending" value={String(pendingCount)} color={pendingCount === 0 ? 'text-cyber-green' : 'text-yellow-400'} />
            <Row label="Failed" value={String(failedSyncCount)} color={failedSyncCount === 0 ? 'text-cyber-green' : 'text-red-400'} />
            <Row label="Last attempt" value={lastSyncAttemptAt ? format(new Date(lastSyncAttemptAt), 'MMM d, h:mm a') : 'Never'} color={lastSyncAttemptAt ? 'text-cyber-text' : 'text-cyber-dim'} />
            <Row label="Last synced" value={lastSyncedAt ? format(new Date(lastSyncedAt), 'MMM d, h:mm a') : 'Never'} color={lastSyncedAt ? 'text-cyber-text' : 'text-cyber-dim'} />
            <Row label="Last restored" value={lastRestoredAt ? format(new Date(lastRestoredAt), 'MMM d, h:mm a') : 'Never'} color={lastRestoredAt ? 'text-cyber-text' : 'text-cyber-dim'} />

            {/* App */}
            <div className="text-[10px] font-mono uppercase tracking-widest text-cyber-dim/60 pt-2">App</div>
            <Row label="Version" value={`v${APP_VERSION}`} color="text-cyber-text" />
            <Row label="Schema" value={`v${SCHEMA_VERSION}`} color="text-cyber-dim" />
            <Row label="Build" value={format(new Date(__BUILD_TIME__), 'MMM d, h:mm a')} color="text-cyber-dim" />

            {syncError && (
              <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-1">Last sync error</div>
                <div className="text-xs font-mono text-red-300 break-words">{syncError}</div>
              </div>
            )}
            {syncFailures.length > 0 && (
              <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-2 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-red-400">Failed records</div>
                {syncFailures.map((f) => (
                  <div key={f.table} className="text-xs font-mono text-red-300 break-words">
                    {f.table}: {f.count} — {f.message}
                  </div>
                ))}
              </div>
            )}
            {!standalone && (
              <div className="text-[10px] font-mono text-cyber-dim/70 pt-1 border-t border-cyber-border/30">
                To install: Safari → Share → Add to Home Screen
              </div>
            )}

            <div className="pt-2">
              <button onClick={handleSyncNow} disabled={syncing || syncStatus === 'syncing'} className="w-full py-2 rounded-lg border border-cyber-green/30 text-cyber-green font-mono text-xs hover:bg-cyber-green/5 transition-colors disabled:opacity-40">
                {syncing || syncStatus === 'syncing' ? 'Syncing...' : failedSyncCount > 0 ? 'Retry Failed Sync' : 'Sync Now'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Goal Mode ────────────────────────────────────────────────────────── */}
      <div className="card mb-3">
        <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-3">Goal Mode</h2>
        <div className="grid grid-cols-3 gap-2">
          {GOAL_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setGoalMode(m.value)}
              className={`py-2 rounded-lg border font-mono text-xs transition-colors ${goalMode === m.value ? 'border-cyber-green text-cyber-green bg-cyber-green/10' : 'border-cyber-border text-cyber-dim hover:border-cyber-green/40'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="card mb-3">
        <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-3">Body</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="form-label">Height (cm)</label>
            <input type="number" min="100" max="250" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="—" className="input-field" />
          </div>
          <div>
            <label className="form-label">Current (kg)</label>
            <input type="number" min="30" max="300" step="0.1" value={currentWeight} onChange={e => setCurrentWeight(e.target.value)} placeholder="—" className="input-field" />
          </div>
          <div>
            <label className="form-label">Target (kg)</label>
            <input type="number" min="30" max="300" step="0.1" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder="—" className="input-field" />
          </div>
        </div>
      </div>

      {/* ── Nutrition ────────────────────────────────────────────────────────── */}
      <div className="card mb-3">
        <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-3">Nutrition Goals</h2>
        <div className="space-y-3">
          <div>
            <label className="form-label">Daily Calories (kcal)</label>
            <input type="number" min="800" max="6000" step="50" value={calorieTarget} onChange={e => setCalorieTarget(e.target.value)} placeholder="Optional" className="input-field" />
          </div>
          <div>
            <label className="form-label">Water Goal (ml)</label>
            <input type="number" min="500" max="10000" step="100" value={waterGoal} onChange={e => setWaterGoal(e.target.value)} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Protein Min (g)</label>
              <input type="number" min="50" max="300" value={proteinMin} onChange={e => setProteinMin(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="form-label">Protein Max (g)</label>
              <input type="number" min="50" max="300" value={proteinMax} onChange={e => setProteinMax(e.target.value)} className="input-field" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Activity ─────────────────────────────────────────────────────────── */}
      <div className="card mb-3">
        <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-3">Activity Goals</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="form-label">Steps Min</label>
            <input type="number" min="1000" max="30000" step="500" value={stepsMin} onChange={e => setStepsMin(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="form-label">Steps Max</label>
            <input type="number" min="1000" max="30000" step="500" value={stepsMax} onChange={e => setStepsMax(e.target.value)} className="input-field" />
          </div>
        </div>
        <div>
          <label className="form-label">Workout Days / Week</label>
          <input type="number" min="1" max="7" value={workoutDays} onChange={e => setWorkoutDays(e.target.value)} className="input-field" />
        </div>
      </div>

      {/* ── Sleep ────────────────────────────────────────────────────────────── */}
      <div className="card mb-3">
        <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-3">Sleep Goal</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Min hours</label>
            <input type="number" min="4" max="12" step="0.5" value={sleepMin} onChange={e => setSleepMin(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="form-label">Max hours</label>
            <input type="number" min="4" max="12" step="0.5" value={sleepMax} onChange={e => setSleepMax(e.target.value)} className="input-field" />
          </div>
        </div>
      </div>

      {/* ── Workout ──────────────────────────────────────────────────────────── */}
      <div className="card mb-3">
        <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-3">Workout</h2>
        <label className="form-label">Default Rest Time (sec)</label>
        <input type="number" min="0" max="600" step="5" value={restSeconds} onChange={e => setRestSeconds(e.target.value)} className="input-field" />
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-cyber-text">Timer Sound</div>
              <div className="text-xs text-cyber-dim font-mono">Beep on set/rest completion</div>
            </div>
            <Toggle value={soundEnabled} onChange={setSoundEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-cyber-text">Vibration</div>
              <div className="text-xs text-cyber-dim font-mono">Haptic feedback on timers</div>
            </div>
            <Toggle value={vibrationEnabled} onChange={setVibrationEnabled} />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-lg bg-cyber-green text-cyber-black font-mono font-bold text-sm shadow-glow-sm hover:bg-cyber-green/90 transition-all mb-6 disabled:opacity-60"
      >
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* ── Backup ───────────────────────────────────────────────────────────── */}
      <div className="card mb-3">
        <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-1">Backup & Restore</h2>
        <p className="text-xs text-cyber-dim/70 font-mono mb-3">
          Full backup includes all tables. Photos are stored as base64 — backup files may be large.
        </p>
        <div className="space-y-2">
          <button
            onClick={handleExport}
            className="w-full py-3 rounded-lg border border-cyber-border text-cyber-text font-mono text-sm hover:border-cyber-cyan/40 hover:text-cyber-cyan transition-colors"
          >
            Export Full Backup (JSON)
          </button>
          <label className={`block w-full py-3 rounded-lg border border-cyber-border text-cyber-text font-mono text-sm text-center hover:border-cyber-cyan/40 hover:text-cyber-cyan transition-colors ${importing ? 'opacity-40 cursor-wait' : 'cursor-pointer'}`}>
            {importing ? 'Importing...' : 'Import Backup from JSON'}
            <input type="file" accept=".json" onChange={handleImport} className="sr-only" disabled={importing} />
          </label>
        </div>
        {exportStatus && (
          <div className={`mt-2 text-xs font-mono rounded p-2 ${exportStatus.startsWith('Export failed') ? 'text-red-400 bg-red-400/5 border border-red-400/30' : 'text-cyber-green bg-cyber-green/5 border border-cyber-green/30'}`}>
            {exportStatus}
          </div>
        )}
        {importStatus && (
          <div className={`mt-2 text-xs font-mono rounded p-2 ${importStatus.includes('failed') || importStatus.includes('Failed') ? 'text-red-400 bg-red-400/5 border border-red-400/30' : 'text-cyber-cyan bg-cyber-cyan/5 border border-cyber-cyan/30'}`}>
            {importStatus}
          </div>
        )}
      </div>

      {/* ── Danger Zone ──────────────────────────────────────────────────────── */}
      <div className="card border-cyber-red/20 mb-6">
        <h2 className="text-xs font-mono text-cyber-red uppercase tracking-widest mb-2">Danger Zone</h2>
        <p className="text-xs text-cyber-dim font-mono mb-3">Export a backup before clearing. This cannot be undone.</p>
        <button
          onClick={handleClearAll}
          className="w-full py-3 rounded-lg border border-cyber-red/40 text-cyber-red font-mono text-sm hover:bg-cyber-red/5 transition-colors"
        >
          Clear All Local Data
        </button>
      </div>

      <div className="text-center text-xs font-mono text-cyber-muted">
        FitFlow · Offline-first · $0 to operate
      </div>
    </div>
  )
}
