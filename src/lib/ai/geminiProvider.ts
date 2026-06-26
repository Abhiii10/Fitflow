import type { AIProvider } from './aiProvider'
import type { GenerateWorkoutParams, ModifyWorkoutParams, WeeklyData, WeeklySummary } from './schemas'
import type { ChatMessage, GeneratedPlan, ParsedLogEntry, WorkoutModification } from '@/types'
import {
  chatSystemPrompt,
  workoutGeneratorPrompt,
  workoutModifierPrompt,
  weeklySummaryPrompt,
  nlParserPrompt,
  dailyInsightPrompt,
} from './prompts'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// ─── Gemini wire types ────────────────────────────────────────────────────────

interface GeminiPart {
  text: string
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

interface GeminiRequest {
  system_instruction?: { parts: GeminiPart[] }
  contents: GeminiContent[]
  generationConfig?: {
    temperature?: number
    maxOutputTokens?: number
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content: GeminiContent
    finishReason: string
  }>
  error?: { code: number; message: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function parseJson<T>(raw: string): T {
  try {
    return JSON.parse(stripFences(raw)) as T
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${raw.slice(0, 200)}`)
  }
}

function toContent(msg: ChatMessage): GeminiContent {
  return { role: msg.role, parts: [{ text: msg.text }] }
}

async function callGemini(apiKey: string, body: GeminiRequest): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = (await res.json()) as GeminiResponse

  if (!res.ok || data.error) {
    throw new Error(`Gemini ${data.error?.code ?? res.status}: ${data.error?.message ?? res.statusText}`)
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no content')
  return text
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createGeminiProvider(apiKey: string): AIProvider {
  return {
    name: 'Gemini 2.0 Flash',
    isMock: false,

    async sendChatMessage(history: ChatMessage[], message: string, context: string): Promise<string> {
      return callGemini(apiKey, {
        system_instruction: { parts: [{ text: chatSystemPrompt(context) }] },
        contents: [
          ...history.map(toContent),
          { role: 'user', parts: [{ text: message }] },
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      })
    },

    async generateWorkoutPlans(params: GenerateWorkoutParams): Promise<GeneratedPlan[]> {
      const raw = await callGemini(apiKey, {
        contents: [{ role: 'user', parts: [{ text: workoutGeneratorPrompt(params) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      })
      return parseJson<GeneratedPlan[]>(raw)
    },

    async modifyWorkout(params: ModifyWorkoutParams): Promise<WorkoutModification> {
      const raw = await callGemini(apiKey, {
        contents: [{ role: 'user', parts: [{ text: workoutModifierPrompt(params) }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
      })
      return parseJson<WorkoutModification>(raw)
    },

    async generateWeeklySummary(data: WeeklyData): Promise<WeeklySummary> {
      const raw = await callGemini(apiKey, {
        contents: [{ role: 'user', parts: [{ text: weeklySummaryPrompt(JSON.stringify(data, null, 2)) }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
      })
      return parseJson<WeeklySummary>(raw)
    },

    async parseNaturalLanguageLog(text: string): Promise<ParsedLogEntry[]> {
      const raw = await callGemini(apiKey, {
        contents: [{ role: 'user', parts: [{ text: nlParserPrompt(text) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      })
      return parseJson<ParsedLogEntry[]>(raw)
    },

    async generateDailyInsight(context: string): Promise<string> {
      return callGemini(apiKey, {
        contents: [{ role: 'user', parts: [{ text: dailyInsightPrompt(context) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      })
    },
  }
}
