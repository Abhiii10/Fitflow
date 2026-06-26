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

const WORKER_URL = import.meta.env.VITE_AI_WORKER_URL as string | undefined
const GROQ_URL = WORKER_URL ?? '/api/ai'
const MODEL = 'llama-3.3-70b-versatile'

interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GroqRequest {
  model: string
  messages: GroqMessage[]
  temperature?: number
  max_tokens?: number
}

interface GroqResponse {
  choices?: Array<{ message: { content: string } }>
  error?: { message: string; type: string }
}

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function parseJson<T>(raw: string): T {
  try {
    return JSON.parse(stripFences(raw)) as T
  } catch {
    throw new Error(`Groq returned invalid JSON: ${raw.slice(0, 200)}`)
  }
}

function toGroqRole(role: 'user' | 'model'): 'user' | 'assistant' {
  return role === 'model' ? 'assistant' : 'user'
}

async function callGroq(apiKey: string | undefined, body: GroqRequest): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!WORKER_URL && apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const data = (await res.json()) as GroqResponse

  if (!res.ok || data.error) {
    throw new Error(`Groq ${res.status}: ${data.error?.message ?? res.statusText}`)
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Groq returned no content')
  return text
}

export function createGroqProvider(apiKey?: string): AIProvider {
  return {
    name: 'Groq Llama 3.3',
    isMock: false,

    async sendChatMessage(history: ChatMessage[], message: string, context: string): Promise<string> {
      return callGroq(apiKey, {
        model: MODEL,
        messages: [
          { role: 'system', content: chatSystemPrompt(context) },
          ...history.map(m => ({ role: toGroqRole(m.role), content: m.text })),
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      })
    },

    async generateWorkoutPlans(params: GenerateWorkoutParams): Promise<GeneratedPlan[]> {
      const raw = await callGroq(apiKey, {
        model: MODEL,
        messages: [{ role: 'user', content: workoutGeneratorPrompt(params) }],
        temperature: 0.7,
        max_tokens: 4096,
      })
      return parseJson<GeneratedPlan[]>(raw)
    },

    async modifyWorkout(params: ModifyWorkoutParams): Promise<WorkoutModification> {
      const raw = await callGroq(apiKey, {
        model: MODEL,
        messages: [{ role: 'user', content: workoutModifierPrompt(params) }],
        temperature: 0.5,
        max_tokens: 2048,
      })
      return parseJson<WorkoutModification>(raw)
    },

    async generateWeeklySummary(data: WeeklyData): Promise<WeeklySummary> {
      const raw = await callGroq(apiKey, {
        model: MODEL,
        messages: [{ role: 'user', content: weeklySummaryPrompt(JSON.stringify(data, null, 2)) }],
        temperature: 0.6,
        max_tokens: 1024,
      })
      return parseJson<WeeklySummary>(raw)
    },

    async parseNaturalLanguageLog(text: string): Promise<ParsedLogEntry[]> {
      const raw = await callGroq(apiKey, {
        model: MODEL,
        messages: [{ role: 'user', content: nlParserPrompt(text) }],
        temperature: 0.2,
        max_tokens: 1024,
      })
      return parseJson<ParsedLogEntry[]>(raw)
    },

    async generateDailyInsight(context: string): Promise<string> {
      return callGroq(apiKey, {
        model: MODEL,
        messages: [{ role: 'user', content: dailyInsightPrompt(context) }],
        temperature: 0.7,
        max_tokens: 512,
      })
    },
  }
}
