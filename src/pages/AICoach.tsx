import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAIProvider } from '@/lib/ai/aiProvider'
import { buildFitnessContext } from '@/hooks/useFitnessContext'
import { db } from '@/db/db'
import { generateId } from '@/utils/id'
import { renderMarkdown } from '@/utils/renderMarkdown'
import type { ChatMessage, GeneratedPlan } from '@/types'

// ─── Workout Generator ────────────────────────────────────────────────────────

const GOALS = ['Muscle Gain', 'Fat Loss', 'Endurance', 'General Fitness', 'Strength']
const EXPERIENCES = ['Beginner', 'Intermediate', 'Advanced']
const EQUIPMENT = ['Full Gym', 'Dumbbells Only', 'Bodyweight Only', 'Home Gym (basic)']
const FOCUSES = ['Full Body', 'Push / Pull / Legs', 'Upper / Lower', 'Bro Split']
const DURATIONS = [30, 45, 60, 90]
const DAYS = [2, 3, 4, 5, 6]

function WorkoutGenerator() {
  const navigate = useNavigate()
  const [goal, setGoal] = useState(GOALS[0])
  const [days, setDays] = useState(4)
  const [experience, setExperience] = useState(EXPERIENCES[1])
  const [equipment, setEquipment] = useState(EQUIPMENT[0])
  const [focus, setFocus] = useState(FOCUSES[0])
  const [duration, setDuration] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState<GeneratedPlan[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setError('')
    setGenerated(null)
    setSaved(false)
    try {
      const ai = getAIProvider()
      const plans = await ai.generateWorkoutPlans({ goal, daysPerWeek: days, experience, equipment, focus: focus, durationMinutes: duration })
      setGenerated(plans)
    } catch {
      setError('The built-in coach could not generate that plan. Try again with simpler inputs.')
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!generated) return
    setSaving(true)
    const now = Date.now()
    for (const plan of generated) {
      const planId = generateId()
      await db.workoutPlans.add({
        id: planId,
        name: plan.name,
        description: plan.description,
        daysOfWeek: plan.daysOfWeek,
        dayType: plan.dayType,
        cardioTarget: plan.cardioTarget,
        createdAt: now,
        updatedAt: now,
        pendingSync: true,
        syncStatus: 'pending',
      })
      for (let i = 0; i < plan.exercises.length; i++) {
        const ex = plan.exercises[i]
        if (!ex) continue
        await db.exercises.add({
          id: generateId(),
          planId,
          name: ex.name,
          sets: ex.sets,
          repRangeMin: ex.repRangeMin,
          repRangeMax: ex.repRangeMax,
          reps: ex.repRangeMax,
          restSeconds: ex.restSeconds,
          rirTarget: ex.rirTarget,
          formCues: ex.formCues,
          notes: ex.notes,
          order: i,
          updatedAt: now,
          pendingSync: true,
          syncStatus: 'pending',
        })
      }
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => navigate('/workouts'), 1200)
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div>
          <label className="form-label">Goal</label>
          <div className="flex flex-wrap gap-2">
            {GOALS.map(g => (
              <button key={g} onClick={() => setGoal(g)} className={`px-3 py-1.5 rounded-lg border font-mono text-xs transition-all ${goal === g ? 'border-cyber-green text-cyber-green bg-cyber-green/10' : 'border-cyber-border text-cyber-dim hover:border-cyber-muted'}`}>{g}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">Days Per Week</label>
          <div className="flex gap-2">
            {DAYS.map(d => (
              <button key={d} onClick={() => setDays(d)} className={`flex-1 py-2 rounded-lg border font-mono text-sm transition-all ${days === d ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10' : 'border-cyber-border text-cyber-dim'}`}>{d}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">Experience Level</label>
          <div className="flex gap-2">
            {EXPERIENCES.map(e => (
              <button key={e} onClick={() => setExperience(e)} className={`flex-1 py-2 rounded-lg border font-mono text-xs transition-all ${experience === e ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10' : 'border-cyber-border text-cyber-dim'}`}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">Equipment</label>
          <div className="grid grid-cols-2 gap-2">
            {EQUIPMENT.map(eq => (
              <button key={eq} onClick={() => setEquipment(eq)} className={`py-2 px-3 rounded-lg border font-mono text-xs text-left transition-all ${equipment === eq ? 'border-cyber-green text-cyber-green bg-cyber-green/10' : 'border-cyber-border text-cyber-dim'}`}>{eq}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">Program Structure</label>
          <div className="grid grid-cols-2 gap-2">
            {FOCUSES.map(f => (
              <button key={f} onClick={() => setFocus(f)} className={`py-2 px-3 rounded-lg border font-mono text-xs text-left transition-all ${focus === f ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10' : 'border-cyber-border text-cyber-dim'}`}>{f}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">Session Duration</label>
          <div className="flex gap-2">
            {DURATIONS.map(d => (
              <button key={d} onClick={() => setDuration(d)} className={`flex-1 py-2 rounded-lg border font-mono text-xs transition-all ${duration === d ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10' : 'border-cyber-border text-cyber-dim'}`}>{d}m</button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-400/40 bg-red-400/5 text-red-400 text-sm font-mono">{error}</div>
      )}

      <button onClick={handleGenerate} disabled={loading}
        className="w-full py-4 rounded-xl bg-cyber-green text-cyber-black font-mono font-bold text-base shadow-glow-green disabled:opacity-60 transition-all active:scale-95">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-cyber-black/30 border-t-cyber-black rounded-full animate-spin" />
            Generating...
          </span>
        ) : '⚡ Generate Workout Plan'}
      </button>

      {generated && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="section-title">Generated Plans ({generated.length})</h3>
          {generated.map((plan, pi) => (
            <div key={pi} className="card border-cyber-green/20">
              <div className="font-mono font-bold text-cyber-green mb-1">{plan.name}</div>
              <div className="text-xs text-cyber-dim mb-3">{plan.description}</div>
              {plan.cardioTarget && (
                <div className="text-xs text-cyber-cyan mb-2 font-mono">Cardio: {plan.cardioTarget}</div>
              )}
              <div className="space-y-1.5">
                {plan.exercises.map((ex, ei) => (
                  <div key={ei} className="flex items-center gap-2 text-xs">
                    <span className="w-5 h-5 rounded bg-cyber-panel border border-cyber-border flex items-center justify-center font-mono text-cyber-dim flex-shrink-0">{ei + 1}</span>
                    <span className="text-cyber-text flex-1">{ex.name}</span>
                    <span className="font-mono text-cyber-cyan">
                      {ex.sets}×{ex.repRangeMin ? `${ex.repRangeMin}–${ex.repRangeMax}` : ex.reps}
                    </span>
                    {ex.rirTarget !== undefined && (
                      <span className="font-mono text-cyber-dim">RIR{ex.rirTarget}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button onClick={handleSave} disabled={saving || saved}
            className={`w-full py-4 rounded-xl font-mono font-bold text-base transition-all active:scale-95 ${saved ? 'bg-cyber-green/20 border border-cyber-green text-cyber-green' : 'bg-cyber-cyan/10 border border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/20'}`}>
            {saved ? '✓ Saved! Redirecting...' : saving ? 'Saving...' : 'Save Plans to App'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Voice helpers ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionAPI: any = typeof window !== 'undefined'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null)
  : null

const hasSpeechInput = SpeechRecognitionAPI !== null
const hasSpeechOutput = typeof window !== 'undefined' && 'speechSynthesis' in window

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,3}\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^[-•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .trim()
}

// ─── Voice Mode (GPT-style continuous loop) ───────────────────────────────────

type VoicePhase = 'idle' | 'listening' | 'thinking' | 'speaking'

function VoiceMode({ messages, onAddMessages, onClose }: {
  messages: ChatMessage[]
  onAddMessages: (user: string, ai: string) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [transcript, setTranscript] = useState('')
  const [aiText, setAiText] = useState('')
  const [speakError, setSpeakError] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const messagesRef = useRef(messages)
  const autoListenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keepAliveTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const speechUnlocked = useRef(false)
  const pendingSpeech = useRef<string | null>(null)

  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    // Load voices (async on some browsers)
    if (hasSpeechOutput) window.speechSynthesis.getVoices()
    const t = setTimeout(() => startListening(), 400)
    return () => {
      clearTimeout(t)
      if (autoListenTimer.current) clearTimeout(autoListenTimer.current)
      if (keepAliveTimer.current) clearInterval(keepAliveTimer.current)
      recognitionRef.current?.abort()
      window.speechSynthesis.cancel()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Unlock iOS speech synthesis — MUST be called from a direct user gesture
  function unlockSpeech() {
    if (speechUnlocked.current || !hasSpeechOutput) return
    const primer = new SpeechSynthesisUtterance(' ')
    primer.volume = 0.01
    primer.rate = 10 // instant
    primer.onend = () => {
      speechUnlocked.current = true
      // If AI response arrived while we were unlocking, speak it now
      if (pendingSpeech.current) {
        const text = pendingSpeech.current
        pendingSpeech.current = null
        doSpeak(text)
      }
    }
    window.speechSynthesis.speak(primer)
  }

  function getEnglishVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices()
    return (
      voices.find(v => v.lang === 'en-US' && v.localService) ??
      voices.find(v => v.lang.startsWith('en') && v.localService) ??
      voices.find(v => v.lang.startsWith('en')) ??
      voices[0] ??
      null
    )
  }

  function doSpeak(text: string) {
    if (keepAliveTimer.current) clearInterval(keepAliveTimer.current)
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text))
    const voice = getEnglishVoice()
    if (voice) utterance.voice = voice
    utterance.lang = 'en-US'
    utterance.rate = 1.0
    utterance.volume = 1

    utterance.onstart = () => {
      // iOS keep-alive: speechSynthesis silently stops after ~15s
      keepAliveTimer.current = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause()
          window.speechSynthesis.resume()
        }
      }, 10000)
    }

    utterance.onend = () => {
      if (keepAliveTimer.current) clearInterval(keepAliveTimer.current)
      setPhase('idle')
      autoListenTimer.current = setTimeout(() => startListening(), 800)
    }

    utterance.onerror = (e) => {
      if (keepAliveTimer.current) clearInterval(keepAliveTimer.current)
      // 'interrupted' is normal when we cancel — don't show error
      if ((e as SpeechSynthesisErrorEvent).error !== 'interrupted') {
        setSpeakError(true)
      }
      setPhase('idle')
    }

    window.speechSynthesis.speak(utterance)
  }

  function startListening() {
    if (!SpeechRecognitionAPI) return
    window.speechSynthesis.cancel()
    transcriptRef.current = ''
    setTranscript('')
    setAiText('')
    setSpeakError(false)

    const rec = new SpeechRecognitionAPI()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let final = ''
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript
        else interim += event.results[i][0].transcript
      }
      transcriptRef.current = final.trim() || interim.trim()
      setTranscript((final || interim).trim())
    }

    rec.onend = () => {
      const text = transcriptRef.current.trim()
      if (text) sendToAI(text)
      else setPhase('idle')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error !== 'aborted') setPhase('idle')
    }

    recognitionRef.current = rec
    rec.start()
    setPhase('listening')
  }

  async function sendToAI(text: string) {
    setPhase('thinking')
    try {
      const ai = getAIProvider()
      const context = await buildFitnessContext()
      const history = messagesRef.current.slice(1)
      const reply = await ai.sendChatMessage(history, text, context)
      setAiText(reply)
      onAddMessages(text, reply)
      speakResponse(reply)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const userMsg = msg.includes('429') ? 'Rate limit hit. Try again in a moment.' : 'Sorry, I had trouble responding.'
      setAiText(userMsg)
      onAddMessages(text, userMsg)
      setPhase('idle')
    }
  }

  function speakResponse(text: string) {
    setPhase('speaking')
    if (!hasSpeechOutput) { setPhase('idle'); return }

    if (speechUnlocked.current) {
      doSpeak(text)
    } else {
      // Speech not yet unlocked — store text and unlock now
      // (unlock fires doSpeak via onend when ready)
      pendingSpeech.current = text
      const primer = new SpeechSynthesisUtterance(' ')
      primer.volume = 0.01
      primer.rate = 10
      primer.onend = () => {
        speechUnlocked.current = true
        const t = pendingSpeech.current
        pendingSpeech.current = null
        if (t) doSpeak(t)
      }
      primer.onerror = () => {
        // Unlock failed — just try speaking anyway
        speechUnlocked.current = true
        const t = pendingSpeech.current
        pendingSpeech.current = null
        if (t) doSpeak(t)
      }
      window.speechSynthesis.speak(primer)
    }
  }

  function handleMicTap() {
    // Unlock speech synthesis from this direct user gesture
    unlockSpeech()

    if (autoListenTimer.current) { clearTimeout(autoListenTimer.current); autoListenTimer.current = null }
    if (phase === 'listening') {
      recognitionRef.current?.stop()
    } else if (phase === 'speaking') {
      if (keepAliveTimer.current) clearInterval(keepAliveTimer.current)
      window.speechSynthesis.cancel()
      startListening()
    } else if (phase === 'idle') {
      startListening()
    }
    // 'thinking' — ignore, let it finish
  }

  // Tap-to-speak fallback when auto-speak failed
  function handleTapToSpeak() {
    setSpeakError(false)
    if (aiText) doSpeak(aiText)
  }

  const statusText: Record<VoicePhase, string> = {
    idle: 'Tap to speak',
    listening: 'Listening...',
    thinking: 'Thinking...',
    speaking: 'Tap to interrupt',
  }

  const ringClass: Record<VoicePhase, string> = {
    idle: 'border-cyber-border',
    listening: 'border-cyber-green',
    thinking: 'border-cyber-cyan',
    speaking: 'border-cyber-cyan',
  }

  const btnClass: Record<VoicePhase, string> = {
    idle: 'border-cyber-border bg-cyber-card',
    listening: 'border-cyber-green bg-cyber-green/10',
    thinking: 'border-cyber-cyan bg-cyber-cyan/5',
    speaking: 'border-cyber-cyan bg-cyber-cyan/10',
  }

  const micColor: Record<VoicePhase, string> = {
    idle: 'text-cyber-dim',
    listening: 'text-cyber-green',
    thinking: 'text-cyber-cyan',
    speaking: 'text-cyber-cyan',
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-cyber-black" style={{ paddingTop: 'env(safe-area-inset-top, 44px)' }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 44px) + 8px)' }}>
        <div className="text-[10px] font-mono text-cyber-cyan uppercase tracking-widest">FitFlow Voice</div>
        <button onClick={onClose} className="p-2 text-cyber-dim hover:text-cyber-text transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Transcript / AI response */}
      <div className="w-full max-w-xs px-6 mb-16 text-center min-h-[100px] flex flex-col items-center justify-center">
        {phase === 'listening' && transcript && (
          <p className="text-cyber-text text-base font-mono leading-relaxed">{transcript}</p>
        )}
        {phase === 'listening' && !transcript && (
          <p className="text-cyber-dim text-sm font-mono">Say something...</p>
        )}
        {(phase === 'speaking' || phase === 'idle') && aiText && (
          <p className="text-cyber-text text-sm leading-relaxed text-center">
            {aiText.length > 220 ? aiText.slice(0, 220) + '…' : aiText}
          </p>
        )}
        {phase === 'thinking' && (
          <div className="flex gap-1.5 items-center">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-2 h-2 rounded-full bg-cyber-cyan animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
        {speakError && aiText && (
          <button
            onClick={handleTapToSpeak}
            className="mt-3 px-4 py-2 rounded-full border border-cyber-cyan/40 text-cyber-cyan text-xs font-mono hover:bg-cyber-cyan/10 transition-colors"
          >
            ▶ Tap to hear response
          </button>
        )}
      </div>

      {/* Mic button */}
      <button onClick={handleMicTap} className="relative flex items-center justify-center" disabled={phase === 'thinking'}>
        {/* Pulse rings */}
        {phase === 'listening' && (
          <>
            <span className={`absolute w-40 h-40 rounded-full border ${ringClass[phase]} animate-ping opacity-10`} />
            <span className={`absolute w-32 h-32 rounded-full border ${ringClass[phase]} animate-ping opacity-20`} style={{ animationDelay: '150ms' }} />
          </>
        )}
        {phase === 'speaking' && (
          <span className={`absolute w-32 h-32 rounded-full border ${ringClass[phase]} animate-pulse opacity-30`} />
        )}
        {/* Button */}
        <span className={`relative z-10 w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${btnClass[phase]}`}>
          {phase === 'thinking' ? (
            <span className="w-7 h-7 border-2 border-cyber-cyan/30 border-t-cyber-cyan rounded-full animate-spin" />
          ) : (
            <svg className={`w-9 h-9 transition-colors duration-300 ${micColor[phase]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
        </span>
      </button>

      {/* Status */}
      <p className="mt-8 text-xs font-mono text-cyber-dim">{statusText[phase]}</p>

      {/* Recent chat history (last 4 messages) */}
      {messages.length > 1 && (
        <div className="absolute bottom-8 left-0 right-0 px-5 space-y-1 max-h-28 overflow-hidden">
          {messages.slice(-4).map((m, i) => (
            <div key={i} className={`text-[11px] font-mono truncate ${m.role === 'user' ? 'text-right text-cyber-green/70' : 'text-left text-cyber-dim'}`}>
              {m.role === 'user' ? '→ ' : '← '}{m.text.slice(0, 60)}{m.text.length > 60 ? '…' : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "Hey! I'm your FitFlow AI coach. Ask me anything about training, nutrition, recovery, or your Aesthetic Physique Program!" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
  const [voiceMode, setVoiceMode] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current)
    }
  }, [])

  function startStreaming(text: string, baseMessages: ChatMessage[]) {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current)
    let i = 0
    setStreamingText('')
    // ~12ms per char ≈ 83 chars/s; cap at 8ms for very long replies
    const delay = text.length > 400 ? 8 : 12
    streamIntervalRef.current = setInterval(() => {
      i += 1
      setStreamingText(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(streamIntervalRef.current!)
        streamIntervalRef.current = null
        setStreamingText(null)
        setMessages([...baseMessages, { role: 'model', text }])
      }
    }, delay)
  }

  function speakMessage(text: string, idx: number) {
    if (!hasSpeechOutput) return
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel()
      setSpeakingIdx(null)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text))
    utterance.lang = 'en-US'
    utterance.rate = 1.05
    utterance.onend = () => setSpeakingIdx(null)
    utterance.onerror = () => setSpeakingIdx(null)
    setSpeakingIdx(idx)
    window.speechSynthesis.speak(utterance)
  }

  async function handleSend() {
    if (!input.trim() || loading || streamingText !== null) return
    const userText = input.trim()
    setInput('')
    const newMessages: ChatMessage[] = [...messages, { role: 'user', text: userText }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const ai = getAIProvider()
      const context = await buildFitnessContext()
      const history = newMessages.slice(1, -1)
      const reply = await ai.sendChatMessage(history, userText, context)
      setLoading(false)
      startStreaming(reply, newMessages)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const userMsg = msg.includes('429')
        ? 'Rate limit hit. Wait a moment and try again.'
        : msg.includes('403') || msg.includes('401')
        ? 'API key issue — check your key in .env.'
        : `Error: ${msg}`
      setMessages([...newMessages, { role: 'model', text: userMsg }])
      setLoading(false)
    }
  }

  function handleVoiceMessages(userText: string, aiReply: string) {
    setMessages(prev => [...prev,
      { role: 'user', text: userText },
      { role: 'model', text: aiReply },
    ])
  }

  return (
    <>
      {voiceMode && hasSpeechInput && (
        <VoiceMode
          messages={messages}
          onAddMessages={handleVoiceMessages}
          onClose={() => setVoiceMode(false)}
        />
      )}

      <div className="flex flex-col h-[calc(100vh-220px)]">
        <div className="flex-1 overflow-y-auto space-y-3 pb-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-cyber-green/10 border border-cyber-green/30 text-cyber-text rounded-tr-sm'
                  : 'bg-cyber-card border border-cyber-border text-cyber-text rounded-tl-sm'
              }`}>
                {msg.role === 'model' && (
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] font-mono text-cyber-cyan uppercase tracking-widest">FitFlow AI</div>
                    {hasSpeechOutput && (
                      <button
                        onClick={() => speakMessage(msg.text, i)}
                        className={`ml-3 p-1 rounded transition-colors ${speakingIdx === i ? 'text-cyber-cyan' : 'text-cyber-dim/50 hover:text-cyber-dim'}`}
                      >
                        {speakingIdx === i ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                )}
                <div className="leading-relaxed text-sm">{msg.role === 'model' ? renderMarkdown(msg.text) : msg.text}</div>
              </div>
            </div>
          ))}
          {streamingText !== null && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm bg-cyber-card border border-cyber-border text-cyber-text">
                <div className="text-[10px] font-mono text-cyber-cyan uppercase tracking-widest mb-1">FitFlow AI</div>
                <div className="leading-relaxed text-sm">
                  {renderMarkdown(streamingText)}
                  <span className="inline-block w-0.5 h-3.5 bg-cyber-cyan animate-pulse ml-0.5 align-middle" />
                </div>
              </div>
            </div>
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-cyber-card border border-cyber-border px-4 py-3 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-2 h-2 rounded-full bg-cyber-cyan animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 pb-3">
            {['Am I on track today?', 'What should I eat?', "Suggest today's workout", 'How do I grow side delts?'].map(prompt => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="px-3 py-1.5 rounded-full border border-cyber-border text-xs font-mono text-cyber-dim hover:text-cyber-green hover:border-cyber-green/40 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t border-cyber-border">
          {hasSpeechInput && (
            <button
              onClick={() => setVoiceMode(true)}
              className="px-3 py-3 rounded-xl border border-cyber-border text-cyber-dim hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-all"
              title="Voice mode"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask your AI coach..."
            className="flex-1 px-4 py-3 bg-cyber-dark border border-cyber-border rounded-xl text-cyber-text text-sm focus:outline-none focus:border-cyber-cyan/60 placeholder-cyber-muted font-mono"
          />
          <button onClick={handleSend} disabled={loading || streamingText !== null || !input.trim()}
            className="px-4 py-3 rounded-xl bg-cyber-cyan/10 border border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/20 transition-colors disabled:opacity-40">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AICoach() {
  const [tab, setTab] = useState<'generate' | 'chat'>('generate')
  const ai = (() => { try { return getAIProvider() } catch { return null } })()

  return (
    <div className="page-container">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-cyber-green/10 border border-cyber-green/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-cyber-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <h1 className="page-title">AI Coach</h1>
        {ai && (
          <span className="ml-auto text-[10px] font-mono border px-2 py-0.5 rounded text-cyber-green border-cyber-green/30">
            {ai.name}
          </span>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-cyber-panel border border-cyber-border rounded-xl mb-5">
        {(['generate', 'chat'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg font-mono text-sm font-semibold transition-all capitalize ${tab === t ? 'bg-cyber-card border border-cyber-border text-cyber-text shadow-sm' : 'text-cyber-dim hover:text-cyber-text'}`}>
            {t === 'generate' ? '⚡ Generate' : '💬 Chat'}
          </button>
        ))}
      </div>

      {tab === 'generate' ? <WorkoutGenerator /> : <AIChat />}
    </div>
  )
}
