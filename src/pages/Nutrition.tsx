import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { useStore } from '@/store/useStore'
import { ProgressRing } from '@/components/ProgressRing'
import { todayStr } from '@/utils/date'
import { generateId } from '@/utils/id'
import { format } from 'date-fns'
import { getAIProvider } from '@/lib/ai/aiProvider'
import type { ProteinLog } from '@/types'

// ─── Protein quick-add meals ────────────────────────────────────────────────

const QUICK_MEALS = [
  { label: 'Chicken Breast (200g)', amountG: 46 },
  { label: 'Greek Yogurt', amountG: 17 },
  { label: 'Eggs x3', amountG: 18 },
  { label: 'Whey Shake', amountG: 25 },
  { label: 'Tuna Can', amountG: 30 },
  { label: 'Cottage Cheese', amountG: 14 },
  { label: 'Salmon (150g)', amountG: 30 },
  { label: 'Beef (200g)', amountG: 42 },
]

// ─── Macro quick-add meals (South Asian) ────────────────────────────────────

const MACRO_MEALS = [
  { label: 'Dal Bhat (1 plate)', cal: 600, p: 20, c: 110, f: 8 },
  { label: 'Chicken Curry (200g)', cal: 280, p: 36, c: 8, f: 12 },
  { label: 'Roti x2', cal: 200, p: 6, c: 38, f: 4 },
  { label: 'Momo (8 pcs)', cal: 400, p: 18, c: 48, f: 16 },
  { label: 'Chiura (1 cup)', cal: 350, p: 5, c: 75, f: 3 },
  { label: 'Eggs x3', cal: 210, p: 18, c: 1, f: 14 },
  { label: 'Whey Shake', cal: 150, p: 25, c: 10, f: 2 },
  { label: 'Chicken Breast (200g)', cal: 330, p: 46, c: 0, f: 7 },
  { label: 'Greek Yogurt (200g)', cal: 130, p: 18, c: 10, f: 2 },
  { label: 'Aloo Tarkari', cal: 200, p: 4, c: 38, f: 6 },
]

// ─── MacroBar component ──────────────────────────────────────────────────────

function MacroBar({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) {
  const pct = Math.min(100, (current / goal) * 100)
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs font-mono text-cyber-dim">{label}</span>
        <span className="text-xs font-mono" style={{ color }}>{current} / {goal}{label === 'Calories' ? 'kcal' : 'g'}</span>
      </div>
      <div className="h-2 bg-cyber-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function Nutrition() {
  const { profile } = useStore()
  const today = todayStr()

  const [tab, setTab] = useState<'protein' | 'macros'>('protein')

  // ── Protein tab state ──
  const [mealName, setMealName] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [adding, setAdding] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiParsing, setAiParsing] = useState(false)
  const [aiResult, setAiResult] = useState<{ amountG: number; mealName: string } | null>(null)
  const [aiError, setAiError] = useState('')
  const [aiSuggest, setAiSuggest] = useState<string | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)

  // ── Macro tab state ──
  const [macroMealName, setMacroMealName] = useState('')
  const [macroCal, setMacroCal] = useState('')
  const [macroP, setMacroP] = useState('')
  const [macroC, setMacroC] = useState('')
  const [macroF, setMacroF] = useState('')
  const [macroAdding, setMacroAdding] = useState(false)
  const [macroSuggest, setMacroSuggest] = useState<string | null>(null)
  const [macroSuggestLoading, setMacroSuggestLoading] = useState(false)

  // ── Protein queries ──
  const logs = useLiveQuery(
    () => db.proteinLogs.where('date').equals(today).filter(l => !l.deletedAt).toArray(),
    [today]
  )

  const proteinGoalMin = profile?.proteinGoalMinG ?? 140
  const proteinGoalMax = profile?.proteinGoalMaxG ?? 160
  const total = logs?.reduce((s, l) => s + l.amountG, 0) ?? 0
  const pct = Math.min(100, (total / proteinGoalMax) * 100)

  // ── Macro queries ──
  const macroLogs = useLiveQuery(
    () => db.macroLogs.where('date').equals(today).filter(l => !l.deletedAt).toArray(),
    [today]
  )
  const totalCal = macroLogs?.reduce((s, l) => s + l.calories, 0) ?? 0
  const totalMacroP = macroLogs?.reduce((s, l) => s + l.proteinG, 0) ?? 0
  const totalCarbs = macroLogs?.reduce((s, l) => s + l.carbsG, 0) ?? 0
  const totalFat = macroLogs?.reduce((s, l) => s + l.fatG, 0) ?? 0

  // ── Protein actions ──

  async function addEntry(amountG: number, name?: string) {
    const entry: ProteinLog = {
      id: generateId(),
      date: today,
      amountG,
      mealName: name,
      loggedAt: Date.now(),
      updatedAt: Date.now(),
      pendingSync: true,
      syncStatus: 'pending',
    }
    await db.proteinLogs.add(entry)
  }

  async function handleQuickAdd(meal: typeof QUICK_MEALS[0]) {
    await addEntry(meal.amountG, meal.label)
  }

  async function handleCustomAdd() {
    const g = parseFloat(amountStr)
    if (isNaN(g) || g <= 0) return
    setAdding(true)
    await addEntry(g, mealName || undefined)
    setMealName('')
    setAmountStr('')
    setAdding(false)
  }

  async function handleAIParse() {
    if (!aiInput.trim()) return
    setAiParsing(true)
    setAiError('')
    setAiResult(null)
    try {
      const ai = getAIProvider()
      const entries = await ai.parseNaturalLanguageLog(aiInput.trim())
      const protein = entries.find(e => e.type === 'protein')
      if (protein) {
        const d = protein.data as { amountG?: number; mealName?: string }
        setAiResult({ amountG: d.amountG ?? 0, mealName: d.mealName ?? aiInput.trim() })
      } else {
        setAiError('Could not find protein info. Try: "2 eggs and 100g chicken"')
      }
    } catch {
      setAiError('AI unavailable. Add a Gemini API key in Settings.')
    }
    setAiParsing(false)
  }

  async function confirmAiResult() {
    if (!aiResult) return
    await addEntry(aiResult.amountG, aiResult.mealName)
    setAiResult(null)
    setAiInput('')
  }

  async function deleteLog(id: string) {
    await db.proteinLogs.update(id, { deletedAt: Date.now(), updatedAt: Date.now(), pendingSync: true, syncStatus: 'pending' })
  }

  async function handleAISuggest() {
    setSuggestLoading(true)
    setAiSuggest(null)
    try {
      const ai = getAIProvider()
      const remaining = Math.max(0, proteinGoalMin - total)
      const prompt = `I've had ${total}g protein today. I need ${remaining}g more to hit my minimum target of ${proteinGoalMin}g. Today is ${format(new Date(), 'EEEE')}. Suggest 1-2 quick meals I can eat right now. Be specific with amounts and mention the protein per meal. Keep it to 2-3 sentences.`
      const reply = await ai.sendChatMessage([], prompt, '')
      setAiSuggest(reply)
    } catch {
      setAiSuggest('AI unavailable right now.')
    }
    setSuggestLoading(false)
  }

  // ── Macro actions ──

  async function addMacroEntry(meal: typeof MACRO_MEALS[0], name?: string) {
    await db.macroLogs.add({
      id: generateId(),
      date: today,
      mealName: name ?? meal.label,
      calories: meal.cal,
      proteinG: meal.p,
      carbsG: meal.c,
      fatG: meal.f,
      loggedAt: Date.now(),
      updatedAt: Date.now(),
      pendingSync: true,
      syncStatus: 'pending',
    })
  }

  async function handleMacroQuickAdd(meal: typeof MACRO_MEALS[0]) {
    await addMacroEntry(meal)
  }

  async function handleMacroCustomAdd() {
    const cal = parseFloat(macroCal)
    const p = parseFloat(macroP)
    const c = parseFloat(macroC)
    const f = parseFloat(macroF)
    if (isNaN(cal) || cal <= 0) return
    setMacroAdding(true)
    await addMacroEntry(
      { label: macroMealName || 'Custom meal', cal, p: isNaN(p) ? 0 : p, c: isNaN(c) ? 0 : c, f: isNaN(f) ? 0 : f },
      macroMealName || undefined
    )
    setMacroMealName('')
    setMacroCal('')
    setMacroP('')
    setMacroC('')
    setMacroF('')
    setMacroAdding(false)
  }

  async function deleteMacroLog(id: string) {
    await db.macroLogs.update(id, { deletedAt: Date.now(), updatedAt: Date.now(), pendingSync: true, syncStatus: 'pending' })
  }

  async function handleMacroAISuggest() {
    setMacroSuggestLoading(true)
    setMacroSuggest(null)
    try {
      const ai = getAIProvider()
      const calLeft = Math.max(0, 2500 - totalCal)
      const pLeft = Math.max(0, proteinGoalMin - totalMacroP)
      const prompt = `I've logged ${totalCal} kcal, ${totalMacroP}g protein, ${totalCarbs}g carbs, ${totalFat}g fat today. I still need about ${calLeft} kcal and ${pLeft}g more protein. Today is ${format(new Date(), 'EEEE')}. Suggest 1-2 specific meals I can eat right now to hit my targets. Mention calories and macros. Keep it to 2-3 sentences.`
      const reply = await ai.sendChatMessage([], prompt, '')
      setMacroSuggest(reply)
    } catch {
      setMacroSuggest('AI unavailable right now.')
    }
    setMacroSuggestLoading(false)
  }

  const statusColor = total >= proteinGoalMin ? 'text-cyber-green' : total >= proteinGoalMin * 0.7 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="page-container">
      <div className="mb-5">
        <h1 className="text-xl font-mono font-bold text-cyber-green tracking-tight">Nutrition</h1>
        <p className="text-xs text-cyber-dim font-mono">{format(new Date(), 'EEEE, MMM d')}</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-cyber-panel border border-cyber-border rounded-xl mb-5">
        {(['protein', 'macros'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg font-mono text-sm font-semibold transition-all capitalize ${tab === t ? 'bg-cyber-card border border-cyber-border text-cyber-text shadow-sm' : 'text-cyber-dim hover:text-cyber-text'}`}>
            {t === 'protein' ? '🥩 Protein' : '🍽️ Macros'}
          </button>
        ))}
      </div>

      {/* ─── Protein Tab ──────────────────────────────────────────────────────── */}
      {tab === 'protein' && (
        <>
          {/* Progress Header */}
          <div className="card mb-4 flex items-center gap-5">
            <ProgressRing value={pct} size={72} strokeWidth={6} color="#60a5fa">
              <span className="text-[11px] font-mono text-blue-400 font-bold">{Math.round(pct)}%</span>
            </ProgressRing>
            <div>
              <div className={`text-3xl font-mono font-bold ${statusColor}`}>{total}g</div>
              <div className="text-sm text-cyber-dim font-mono">Goal: {proteinGoalMin}–{proteinGoalMax}g</div>
              <div className="text-xs text-cyber-dim font-mono mt-1">
                {total >= proteinGoalMax ? 'Goal hit!' : `${proteinGoalMin - total > 0 ? proteinGoalMin - total : 0}g to minimum`}
              </div>
            </div>
          </div>

          {/* AI Meal Suggestion */}
          <div className="card mb-4 border-blue-400/20 bg-blue-400/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">What should I eat?</span>
              <button
                onClick={handleAISuggest}
                disabled={suggestLoading}
                className="text-xs font-mono text-blue-400 border border-blue-400/30 px-2 py-1 rounded-lg hover:bg-blue-400/10 transition-colors disabled:opacity-40"
              >
                {suggestLoading ? '...' : '✦ Ask AI'}
              </button>
            </div>
            {aiSuggest ? (
              <p className="text-sm text-cyber-text leading-relaxed">{aiSuggest}</p>
            ) : (
              <p className="text-xs text-cyber-dim font-mono">{total}g logged · {Math.max(0, proteinGoalMin - total)}g to go · tap Ask AI for suggestions</p>
            )}
          </div>

          {/* AI Meal Logging */}
          <h2 className="section-title">AI Log</h2>
          <div className="card mb-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Describe what you ate... e.g. dal bhat, 2 eggs, 100g chicken"
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAIParse()}
                className="flex-1 bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-blue-400/60"
              />
              <button
                onClick={handleAIParse}
                disabled={aiParsing || !aiInput.trim()}
                className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-xs hover:bg-blue-500/20 transition-colors disabled:opacity-40 flex-shrink-0"
              >
                {aiParsing ? '...' : 'Parse'}
              </button>
            </div>
            {aiResult && (
              <div className="rounded-lg border border-cyber-green/30 bg-cyber-green/5 px-3 py-2">
                <div className="text-xs font-mono text-cyber-dim mb-1">{aiResult.mealName}</div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-400 font-mono font-bold">+{aiResult.amountG}g protein</span>
                  <div className="flex gap-2">
                    <button onClick={() => setAiResult(null)} className="text-xs font-mono text-cyber-dim hover:text-red-400">Cancel</button>
                    <button onClick={confirmAiResult} className="text-xs font-mono text-cyber-green hover:underline">Log it</button>
                  </div>
                </div>
              </div>
            )}
            {aiError && <div className="text-xs font-mono text-red-400">{aiError}</div>}
          </div>

          {/* Quick Add Buttons */}
          <h2 className="section-title">Quick Add</h2>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {QUICK_MEALS.map(meal => (
              <button
                key={meal.label}
                onClick={() => handleQuickAdd(meal)}
                className="card text-left hover:border-blue-400/40 transition-colors group"
              >
                <div className="text-sm font-medium text-cyber-text group-hover:text-blue-400 transition-colors">{meal.label}</div>
                <div className="text-xs font-mono text-blue-400 mt-0.5">+{meal.amountG}g</div>
              </button>
            ))}
          </div>

          {/* Custom Entry */}
          <h2 className="section-title">Custom Entry</h2>
          <div className="card mb-4 space-y-3">
            <input
              type="text"
              placeholder="Meal name (optional)"
              value={mealName}
              onChange={e => setMealName(e.target.value)}
              className="w-full bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-blue-400/60"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Protein (g)"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                className="flex-1 bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-blue-400/60"
              />
              <button
                onClick={handleCustomAdd}
                disabled={adding || !amountStr}
                className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-sm hover:bg-blue-500/20 transition-colors disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>

          {/* Today's Protein Log */}
          {logs && logs.length > 0 && (
            <>
              <h2 className="section-title">Today's Log</h2>
              <div className="space-y-2">
                {[...logs].reverse().map(log => (
                  <div key={log.id} className="card flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-cyber-text">{log.mealName ?? 'Protein entry'}</div>
                      <div className="text-xs font-mono text-cyber-dim">
                        {format(new Date(log.loggedAt), 'h:mm a')}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-blue-400 font-mono font-bold">+{log.amountG}g</span>
                      <button
                        onClick={() => deleteLog(log.id)}
                        className="text-cyber-dim hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ─── Macros Tab ───────────────────────────────────────────────────────── */}
      {tab === 'macros' && (
        <>
          {/* Macro Progress Bars */}
          <div className="card mb-4 space-y-3">
            <MacroBar label="Calories" current={totalCal} goal={2500} color="#f59e0b" />
            <MacroBar label="Protein" current={totalMacroP} goal={proteinGoalMin} color="#60a5fa" />
            <MacroBar label="Carbs" current={totalCarbs} goal={300} color="#a78bfa" />
            <MacroBar label="Fat" current={totalFat} goal={80} color="#f97316" />
          </div>

          {/* AI Macro Suggestion */}
          <div className="card mb-4 border-blue-400/20 bg-blue-400/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">What should I eat?</span>
              <button
                onClick={handleMacroAISuggest}
                disabled={macroSuggestLoading}
                className="text-xs font-mono text-blue-400 border border-blue-400/30 px-2 py-1 rounded-lg hover:bg-blue-400/10 transition-colors disabled:opacity-40"
              >
                {macroSuggestLoading ? '...' : '✦ Ask AI'}
              </button>
            </div>
            {macroSuggest ? (
              <p className="text-sm text-cyber-text leading-relaxed">{macroSuggest}</p>
            ) : (
              <p className="text-xs text-cyber-dim font-mono">
                {totalCal} kcal · {totalMacroP}g P · {totalCarbs}g C · {totalFat}g F · tap Ask AI for suggestions
              </p>
            )}
          </div>

          {/* Macro Quick Add */}
          <h2 className="section-title">Quick Add</h2>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {MACRO_MEALS.map(meal => (
              <button
                key={meal.label}
                onClick={() => handleMacroQuickAdd(meal)}
                className="card text-left hover:border-amber-400/40 transition-colors group"
              >
                <div className="text-sm font-medium text-cyber-text group-hover:text-amber-400 transition-colors leading-tight">{meal.label}</div>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className="text-xs font-mono text-amber-400">{meal.cal} kcal</span>
                  <span className="text-xs font-mono text-blue-400">{meal.p}P</span>
                  <span className="text-xs font-mono text-violet-400">{meal.c}C</span>
                  <span className="text-xs font-mono text-orange-400">{meal.f}F</span>
                </div>
              </button>
            ))}
          </div>

          {/* Macro Custom Entry */}
          <h2 className="section-title">Custom Entry</h2>
          <div className="card mb-4 space-y-3">
            <input
              type="text"
              placeholder="Meal name (optional)"
              value={macroMealName}
              onChange={e => setMacroMealName(e.target.value)}
              className="w-full bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-amber-400/60"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Calories"
                value={macroCal}
                onChange={e => setMacroCal(e.target.value)}
                className="bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-amber-400/60"
              />
              <input
                type="number"
                placeholder="Protein (g)"
                value={macroP}
                onChange={e => setMacroP(e.target.value)}
                className="bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-blue-400/60"
              />
              <input
                type="number"
                placeholder="Carbs (g)"
                value={macroC}
                onChange={e => setMacroC(e.target.value)}
                className="bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-violet-400/60"
              />
              <input
                type="number"
                placeholder="Fat (g)"
                value={macroF}
                onChange={e => setMacroF(e.target.value)}
                className="bg-transparent border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-orange-400/60"
              />
            </div>
            <button
              onClick={handleMacroCustomAdd}
              disabled={macroAdding || !macroCal}
              className="w-full py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-sm hover:bg-amber-500/20 transition-colors disabled:opacity-40"
            >
              {macroAdding ? 'Adding...' : 'Add Meal'}
            </button>
          </div>

          {/* Today's Macro Log */}
          {macroLogs && macroLogs.length > 0 && (
            <>
              <h2 className="section-title">Today's Log</h2>
              <div className="space-y-2">
                {[...macroLogs].reverse().map(log => (
                  <div key={log.id} className="card flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-cyber-text truncate">{log.mealName}</div>
                      <div className="flex gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs font-mono text-amber-400">{log.calories} kcal</span>
                        <span className="text-xs font-mono text-blue-400">{log.proteinG}P</span>
                        <span className="text-xs font-mono text-violet-400">{log.carbsG}C</span>
                        <span className="text-xs font-mono text-orange-400">{log.fatG}F</span>
                        <span className="text-xs font-mono text-cyber-dim">{format(new Date(log.loggedAt), 'h:mm a')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMacroLog(log.id)}
                      className="text-cyber-dim hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
