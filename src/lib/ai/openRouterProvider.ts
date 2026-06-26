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

const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'google/gemma-4-26b-a4b-it:free'

interface ORMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ORResponse {
  choices?: Array<{ message: { content: string } }>
  error?: { message: string; code?: number }
}

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function parseJson<T>(raw: string): T {
  try {
    return JSON.parse(stripFences(raw)) as T
  } catch {
    throw new Error(`OpenRouter returned invalid JSON: ${raw.slice(0, 200)}`)
  }
}

function toRole(role: 'user' | 'model'): 'user' | 'assistant' {
  return role === 'model' ? 'assistant' : 'user'
}

async function callOR(apiKey: string, messages: ORMessage[], maxTokens = 1024): Promise<string> {
  const res = await fetch(OR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://fitflow.app',
      'X-Title': 'FitFlow',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0.7 }),
  })

  const data = (await res.json()) as ORResponse

  if (!res.ok || data.error) {
    throw new Error(`OpenRouter ${res.status}: ${data.error?.message ?? res.statusText}`)
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('OpenRouter returned no content')
  return text
}

export function createOpenRouterProvider(apiKey: string): AIProvider {
  return {
    name: 'OpenRouter Gemma 4',
    isMock: false,

    async sendChatMessage(history: ChatMessage[], message: string, context: string): Promise<string> {
      return callOR(apiKey, [
        { role: 'system', content: chatSystemPrompt(context) },
        ...history.map(m => ({ role: toRole(m.role), content: m.text })),
        { role: 'user', content: message },
      ], 1024)
    },

    async generateWorkoutPlans(params: GenerateWorkoutParams): Promise<GeneratedPlan[]> {
      const raw = await callOR(apiKey, [{ role: 'user', content: workoutGeneratorPrompt(params) }], 4096)
      return parseJson<GeneratedPlan[]>(raw)
    },

    async modifyWorkout(params: ModifyWorkoutParams): Promise<WorkoutModification> {
      const raw = await callOR(apiKey, [{ role: 'user', content: workoutModifierPrompt(params) }], 2048)
      return parseJson<WorkoutModification>(raw)
    },

    async generateWeeklySummary(data: WeeklyData): Promise<WeeklySummary> {
      const raw = await callOR(apiKey, [{ role: 'user', content: weeklySummaryPrompt(JSON.stringify(data, null, 2)) }], 1024)
      return parseJson<WeeklySummary>(raw)
    },

    async parseNaturalLanguageLog(text: string): Promise<ParsedLogEntry[]> {
      const raw = await callOR(apiKey, [{ role: 'user', content: nlParserPrompt(text) }], 1024)
      return parseJson<ParsedLogEntry[]>(raw)
    },

    async generateDailyInsight(context: string): Promise<string> {
      return callOR(apiKey, [{ role: 'user', content: dailyInsightPrompt(context) }], 512)
    },
  }
}
