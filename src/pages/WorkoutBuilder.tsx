import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '@/db/db'
import { generateId } from '@/utils/id'
import { dayName } from '@/utils/date'
import { ExerciseCard } from '@/components/ExerciseCard'
import { getAIProvider } from '@/lib/ai/aiProvider'
import type { Exercise } from '@/types'

interface ExerciseForm {
  id: string
  name: string
  sets: string
  reps: string
  durationSeconds: string
  restSeconds: string
  notes: string
  order: number
}

const emptyExercise = (): ExerciseForm => ({
  id: generateId(),
  name: '',
  sets: '3',
  reps: '10',
  durationSeconds: '',
  restSeconds: '60',
  notes: '',
  order: 0,
})

export function WorkoutBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const ai = (() => { try { return getAIProvider() } catch { return null } })()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [exercises, setExercises] = useState<ExerciseForm[]>([])
  const [editingExercise, setEditingExercise] = useState<ExerciseForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // Import state
  const [showImport, setShowImport] = useState(false)
  const [importTab, setImportTab] = useState<'paste' | 'file'>('paste')
  const [importText, setImportText] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')

  useEffect(() => {
    if (!isNew && id) {
      loadPlan(id)
    }
  }, [id, isNew])

  async function loadPlan(planId: string) {
    const plan = await db.workoutPlans.get(planId)
    if (plan) {
      setName(plan.name)
      setDescription(plan.description ?? '')
      setDaysOfWeek(plan.daysOfWeek)
    }
    const exList = await db.exercises
      .where('planId')
      .equals(planId)
      .filter((e) => !e.deletedAt)
      .sortBy('order')
    setExercises(
      exList.map((e) => ({
        id: e.id,
        name: e.name,
        sets: String(e.sets),
        reps: e.reps !== undefined ? String(e.reps) : '',
        durationSeconds: e.durationSeconds !== undefined ? String(e.durationSeconds) : '',
        restSeconds: String(e.restSeconds),
        notes: e.notes ?? '',
        order: e.order,
      }))
    )
  }

  function toggleDay(d: number) {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    )
  }

  function addExercise() {
    const ex = emptyExercise()
    ex.order = exercises.length
    setEditingExercise(ex)
  }

  function saveExerciseEdit() {
    if (!editingExercise || !editingExercise.name.trim()) return
    setExercises((prev) => {
      const idx = prev.findIndex((e) => e.id === editingExercise.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = editingExercise
        return next
      }
      return [...prev, { ...editingExercise, order: prev.length }]
    })
    setEditingExercise(null)
  }

  function deleteExercise(exId: string) {
    setExercises((prev) => prev.filter((e) => e.id !== exId).map((e, i) => ({ ...e, order: i })))
  }

  // ─── Reorder ───────────────────────────────────────────────────────────────

  function moveUp(i: number) {
    if (i === 0) return
    setExercises((prev) => {
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next.map((e, idx) => ({ ...e, order: idx }))
    })
  }

  function moveDown(i: number) {
    setExercises((prev) => {
      if (i >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next.map((e, idx) => ({ ...e, order: idx }))
    })
  }

  function handleDragStart(i: number) {
    setDragIndex(i)
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    setDragOver(i)
  }

  function handleDrop(i: number) {
    if (dragIndex === null || dragIndex === i) {
      setDragIndex(null)
      setDragOver(null)
      return
    }
    setExercises((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(i, 0, moved)
      return next.map((e, idx) => ({ ...e, order: idx }))
    })
    setDragIndex(null)
    setDragOver(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOver(null)
  }

  // ─── Import: file ─────────────────────────────────────────────────────────

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      try {
        if (file.name.toLowerCase().endsWith('.json')) {
          const data = JSON.parse(text) as Array<{
            name?: string; exercise?: string
            sets?: number; reps?: number
            durationSeconds?: number; duration_seconds?: number
            restSeconds?: number; rest_seconds?: number; rest?: number
            notes?: string
          }>
          const arr = Array.isArray(data) ? data : (data as { exercises?: typeof data }).exercises ?? []
          const parsed: ExerciseForm[] = arr
            .filter((ex) => ex.name || ex.exercise)
            .map((ex, i) => ({
              id: generateId(),
              name: (ex.name ?? ex.exercise ?? '').trim(),
              sets: String(ex.sets ?? 3),
              reps: ex.reps ? String(ex.reps) : '',
              durationSeconds: ex.durationSeconds ?? ex.duration_seconds ? String(ex.durationSeconds ?? ex.duration_seconds) : '',
              restSeconds: String(ex.restSeconds ?? ex.rest_seconds ?? ex.rest ?? 60),
              notes: ex.notes ?? '',
              order: exercises.length + i,
            }))
          if (parsed.length === 0) { setImportError('No exercises found in file.'); return }
          setExercises((prev) => [...prev, ...parsed])
          setShowImport(false)
        } else if (file.name.toLowerCase().endsWith('.csv')) {
          const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
          const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ''))
          const get = (row: string[], key: string) => {
            const alts: Record<string, string[]> = {
              name: ['name', 'exercise', 'exercisename'],
              sets: ['sets'],
              reps: ['reps', 'repetitions'],
              rest: ['rest', 'restseconds', 'restsec'],
              duration: ['duration', 'durationseconds', 'durationsec'],
              notes: ['notes', 'note'],
            }
            const keys = alts[key] ?? [key]
            for (const k of keys) {
              const idx = headers.indexOf(k)
              if (idx >= 0) return row[idx]?.trim() ?? ''
            }
            return ''
          }
          const parsed: ExerciseForm[] = lines.slice(1)
            .map((line, i) => {
              const row = line.split(',')
              const nm = get(row, 'name') || row[0]?.trim() || ''
              if (!nm) return null
              return {
                id: generateId(),
                name: nm,
                sets: get(row, 'sets') || '3',
                reps: get(row, 'reps') || '',
                durationSeconds: get(row, 'duration') || '',
                restSeconds: get(row, 'rest') || '60',
                notes: get(row, 'notes') || '',
                order: exercises.length + i,
              }
            })
            .filter(Boolean) as ExerciseForm[]
          if (parsed.length === 0) { setImportError('No exercises found in CSV.'); return }
          setExercises((prev) => [...prev, ...parsed])
          setShowImport(false)
        } else {
          setImportError('Only .json and .csv files are supported.')
        }
      } catch {
        setImportError('Could not parse the file. Check the format and try again.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ─── Import: AI paste ─────────────────────────────────────────────────────

  async function handleAIParse() {
    if (!importText.trim()) return
    if (!ai) { setImportError('AI is not configured. Add an API key in Settings.'); return }
    setImportLoading(true)
    setImportError('')
    try {
      const prompt = `You are a fitness data parser. Extract all exercises from the text below.
Return ONLY a raw JSON array — no markdown, no explanation, no code fences.
Each item: { "name": string, "sets": number, "reps": number | null, "restSeconds": number, "notes": string }
If reps not specified, use null. If rest not specified, use 60. If sets not specified, use 3.

Workout text:
${importText.slice(0, 2000)}`
      const raw = await ai.sendChatMessage([], prompt, '')
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const data = JSON.parse(clean) as Array<{
        name: string; sets: number; reps: number | null; restSeconds: number; notes: string
      }>
      if (!Array.isArray(data) || data.length === 0) throw new Error('empty')
      const parsed: ExerciseForm[] = data.map((ex, i) => ({
        id: generateId(),
        name: ex.name ?? '',
        sets: String(ex.sets ?? 3),
        reps: ex.reps ? String(ex.reps) : '',
        durationSeconds: '',
        restSeconds: String(ex.restSeconds ?? 60),
        notes: ex.notes ?? '',
        order: exercises.length + i,
      }))
      setExercises((prev) => [...prev, ...parsed])
      setShowImport(false)
      setImportText('')
    } catch {
      setImportError('AI could not parse that text. Try to include exercise names, sets, and reps clearly.')
    } finally {
      setImportLoading(false)
    }
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function savePlan() {
    if (!name.trim()) {
      setError('Plan name is required')
      return
    }
    setSaving(true)
    const now = Date.now()
    const planId = isNew ? generateId() : id!

    if (isNew) {
      await db.workoutPlans.add({
        id: planId,
        name: name.trim(),
        description: description.trim() || undefined,
        daysOfWeek,
        createdAt: now,
        updatedAt: now,
        pendingSync: true,
        syncStatus: 'pending',
      })
    } else {
      await db.workoutPlans.update(planId, {
        name: name.trim(),
        description: description.trim() || undefined,
        daysOfWeek,
        updatedAt: now,
        pendingSync: true,
        syncStatus: 'pending',
      })
      const existing = await db.exercises
        .where('planId')
        .equals(planId)
        .filter((e) => !e.deletedAt)
        .toArray()
      const keepIds = new Set(exercises.map((e) => e.id))
      for (const ex of existing) {
        if (!keepIds.has(ex.id)) {
          await db.exercises.update(ex.id, { deletedAt: now, updatedAt: now, pendingSync: true, syncStatus: 'pending' })
        }
      }
    }

    for (const ex of exercises) {
      const parsed: Exercise = {
        id: ex.id,
        planId,
        name: ex.name.trim(),
        sets: parseInt(ex.sets) || 1,
        reps: ex.reps ? parseInt(ex.reps) : undefined,
        durationSeconds: ex.durationSeconds ? parseInt(ex.durationSeconds) : undefined,
        restSeconds: parseInt(ex.restSeconds) || 60,
        order: ex.order,
        notes: ex.notes.trim() || undefined,
        updatedAt: now,
        pendingSync: true,
        syncStatus: 'pending',
      }
      await db.exercises.put(parsed)
    }

    setSaving(false)
    navigate(`/workouts/${planId}`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(isNew ? '/workouts' : `/workouts/${id}`)}
          className="p-1 text-cyber-dim hover:text-cyber-text transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="page-title">{isNew ? 'New Plan' : 'Edit Plan'}</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-cyber-red/40 bg-cyber-red/5 text-cyber-red text-sm font-mono">
          {error}
        </div>
      )}

      {/* Plan Name */}
      <div className="card mb-3">
        <label className="form-label">Plan Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError('') }}
          placeholder="e.g. Push Day"
          className="input-field"
        />
        <label className="form-label mt-3">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          className="input-field"
        />
      </div>

      {/* Days of Week */}
      <div className="card mb-3">
        <label className="form-label">Days of Week</label>
        <div className="flex gap-1.5 flex-wrap">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              className={`px-3 py-1.5 rounded-lg border font-mono text-xs transition-all ${
                daysOfWeek.includes(d)
                  ? 'border-cyber-cyan/60 bg-cyber-cyan/10 text-cyber-cyan'
                  : 'border-cyber-border bg-cyber-panel text-cyber-dim hover:border-cyber-border/80'
              }`}
            >
              {dayName(d)}
            </button>
          ))}
        </div>
      </div>

      {/* Exercises */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title mb-0">Exercises</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowImport(true); setImportError(''); setImportText('') }}
              className="text-xs font-mono text-cyber-cyan hover:text-cyber-text transition-colors"
            >
              ↑ Import
            </button>
            <button onClick={addExercise} className="text-xs font-mono text-cyber-cyan hover:text-cyber-text transition-colors">
              + Add
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {exercises.map((ex, i) => (
            <div
              key={ex.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
              className={`flex items-stretch gap-2 transition-opacity rounded-xl ${
                dragIndex === i ? 'opacity-30' : dragOver === i ? 'ring-1 ring-cyber-cyan/40' : ''
              }`}
            >
              {/* Drag handle + arrows */}
              <div className="flex flex-col items-center justify-center gap-0.5 px-1 py-2 cursor-grab active:cursor-grabbing select-none">
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="p-0.5 text-cyber-dim/50 hover:text-cyber-cyan disabled:opacity-20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <svg className="w-3.5 h-3.5 text-cyber-dim/30" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                </svg>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === exercises.length - 1}
                  className="p-0.5 text-cyber-dim/50 hover:text-cyber-cyan disabled:opacity-20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <ExerciseCard
                  exercise={{
                    id: ex.id,
                    planId: '',
                    name: ex.name,
                    sets: parseInt(ex.sets) || 1,
                    reps: ex.reps ? parseInt(ex.reps) : undefined,
                    durationSeconds: ex.durationSeconds ? parseInt(ex.durationSeconds) : undefined,
                    restSeconds: parseInt(ex.restSeconds) || 60,
                    order: ex.order,
                    notes: ex.notes || undefined,
                    updatedAt: 0,
                    pendingSync: false,
                  }}
                  index={i}
                  onEdit={() => setEditingExercise(ex)}
                  onDelete={() => deleteExercise(ex.id)}
                />
              </div>
            </div>
          ))}
        </div>

        {exercises.length === 0 && !editingExercise && (
          <div className="card text-center py-6 text-cyber-dim text-sm font-mono">
            No exercises. Tap "+ Add" or "↑ Import" to get started.
          </div>
        )}
      </div>

      {/* Exercise Editor Modal */}
      {editingExercise && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-cyber-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-cyber-dark border-t border-cyber-border rounded-t-2xl p-5 animate-slide-up max-h-[85vh] overflow-y-auto">
            <h3 className="font-mono font-bold text-cyber-text mb-4">
              {exercises.find((e) => e.id === editingExercise.id) ? 'Edit Exercise' : 'Add Exercise'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="form-label">Exercise Name *</label>
                <input
                  type="text"
                  value={editingExercise.name}
                  onChange={(e) => setEditingExercise({ ...editingExercise, name: e.target.value })}
                  placeholder="e.g. Bench Press"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Sets</label>
                  <input type="number" min="1" value={editingExercise.sets} onChange={(e) => setEditingExercise({ ...editingExercise, sets: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="form-label">Reps (or blank)</label>
                  <input type="number" min="1" value={editingExercise.reps} onChange={(e) => setEditingExercise({ ...editingExercise, reps: e.target.value })} className="input-field" placeholder="—" />
                </div>
                <div>
                  <label className="form-label">Duration (sec)</label>
                  <input type="number" min="1" value={editingExercise.durationSeconds} onChange={(e) => setEditingExercise({ ...editingExercise, durationSeconds: e.target.value })} className="input-field" placeholder="—" />
                </div>
                <div>
                  <label className="form-label">Rest (sec)</label>
                  <input type="number" min="0" value={editingExercise.restSeconds} onChange={(e) => setEditingExercise({ ...editingExercise, restSeconds: e.target.value })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <input type="text" value={editingExercise.notes} onChange={(e) => setEditingExercise({ ...editingExercise, notes: e.target.value })} placeholder="Optional notes" className="input-field" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditingExercise(null)}
                className="flex-1 py-3 rounded-lg border border-cyber-border text-cyber-dim font-mono text-sm hover:text-cyber-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveExerciseEdit}
                disabled={!editingExercise.name.trim()}
                className="flex-1 py-3 rounded-lg bg-cyber-green/10 border border-cyber-green/40 text-cyber-green font-mono font-semibold text-sm hover:bg-cyber-green/20 transition-colors disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-cyber-black/80 backdrop-blur-sm" onClick={() => setShowImport(false)}>
          <div
            className="w-full max-w-lg bg-cyber-dark border-t border-cyber-border rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono font-bold text-cyber-text">Import Exercises</h3>
              <button onClick={() => setShowImport(false)} className="text-cyber-dim hover:text-cyber-text transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Import tabs */}
            <div className="flex gap-1 p-1 bg-cyber-panel border border-cyber-border rounded-xl mb-4">
              {(['paste', 'file'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setImportTab(t); setImportError('') }}
                  className={`flex-1 py-2 rounded-lg font-mono text-sm font-semibold transition-all ${
                    importTab === t
                      ? 'bg-cyber-card border border-cyber-border text-cyber-text shadow-sm'
                      : 'text-cyber-dim hover:text-cyber-text'
                  }`}
                >
                  {t === 'paste' ? '✦ Paste & AI Parse' : '📁 Upload File'}
                </button>
              ))}
            </div>

            {importTab === 'paste' && (
              <div>
                <p className="text-xs font-mono text-cyber-dim mb-2">
                  Paste any workout text — from a fitness site, Reddit, PDF, anywhere. AI will extract the exercises.
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Example:\nBench Press 4x8\nIncline DB Press 3x10-12\nCable Fly 3x15, rest 60s\nOverhead Tricep Extension 3x12`}
                  rows={7}
                  className="w-full bg-transparent border border-cyber-border rounded-xl px-3 py-2.5 text-sm text-cyber-text font-mono placeholder:text-cyber-dim/50 focus:outline-none focus:border-cyber-cyan/40 resize-none"
                />
                {importError && (
                  <p className="mt-2 text-xs font-mono text-red-400">{importError}</p>
                )}
                <button
                  onClick={handleAIParse}
                  disabled={importLoading || !importText.trim()}
                  className="mt-3 w-full py-3 rounded-xl bg-cyber-cyan/10 border border-cyber-cyan/40 text-cyber-cyan font-mono font-semibold text-sm hover:bg-cyber-cyan/20 transition-colors disabled:opacity-40"
                >
                  {importLoading ? 'Parsing...' : '✦ Parse with AI'}
                </button>
              </div>
            )}

            {importTab === 'file' && (
              <div>
                <p className="text-xs font-mono text-cyber-dim mb-3">
                  Upload a <span className="text-cyber-text">.json</span> or <span className="text-cyber-text">.csv</span> file exported from another fitness app.
                </p>

                <label className="block cursor-pointer">
                  <div className="flex flex-col items-center justify-center gap-2 p-6 border border-dashed border-cyber-border rounded-xl hover:border-cyber-cyan/40 transition-colors">
                    <span className="text-2xl">📁</span>
                    <span className="text-sm font-mono text-cyber-dim">Tap to choose file</span>
                    <span className="text-xs font-mono text-cyber-dim/60">.json · .csv</span>
                  </div>
                  <input
                    type="file"
                    accept=".json,.csv"
                    className="hidden"
                    onChange={handleFileImport}
                  />
                </label>

                {importError && (
                  <p className="mt-2 text-xs font-mono text-red-400">{importError}</p>
                )}

                <div className="mt-4 p-3 rounded-xl bg-cyber-panel border border-cyber-border">
                  <div className="text-[10px] font-mono text-cyber-dim uppercase tracking-widest mb-2">Expected formats</div>
                  <div className="text-[11px] font-mono text-cyber-dim space-y-1">
                    <div><span className="text-cyber-cyan">JSON:</span> {'[{ "name", "sets", "reps", "restSeconds", "notes" }]'}</div>
                    <div><span className="text-cyber-cyan">CSV:</span> name, sets, reps, rest, notes (header row)</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={savePlan}
        disabled={saving}
        className="w-full py-4 rounded-xl bg-cyber-green text-cyber-black font-mono font-bold text-base hover:bg-cyber-green/90 transition-all active:scale-95 shadow-glow-green disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save Plan'}
      </button>
    </div>
  )
}
