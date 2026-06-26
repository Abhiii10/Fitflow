import type { AIProvider } from './aiProvider'
import type { GenerateWorkoutParams, ModifyWorkoutParams, WeeklyData, WeeklySummary } from './schemas'
import type { ChatMessage, GeneratedPlan, ParsedLogEntry, WorkoutModification } from '@/types'

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('429') || msg.toLowerCase().includes('rate limit')
}

function wrap<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  return primary().catch(err => {
    if (isRateLimit(err)) return fallback()
    throw err
  })
}

export function withFallback(primary: AIProvider, fallback: AIProvider): AIProvider {
  return {
    get name() { return primary.name },
    isMock: false,

    sendChatMessage(history: ChatMessage[], message: string, context: string): Promise<string> {
      return wrap(
        () => primary.sendChatMessage(history, message, context),
        () => fallback.sendChatMessage(history, message, context),
      )
    },

    generateWorkoutPlans(params: GenerateWorkoutParams): Promise<GeneratedPlan[]> {
      return wrap(
        () => primary.generateWorkoutPlans(params),
        () => fallback.generateWorkoutPlans(params),
      )
    },

    modifyWorkout(params: ModifyWorkoutParams): Promise<WorkoutModification> {
      return wrap(
        () => primary.modifyWorkout(params),
        () => fallback.modifyWorkout(params),
      )
    },

    generateWeeklySummary(data: WeeklyData): Promise<WeeklySummary> {
      return wrap(
        () => primary.generateWeeklySummary(data),
        () => fallback.generateWeeklySummary(data),
      )
    },

    parseNaturalLanguageLog(text: string): Promise<ParsedLogEntry[]> {
      return wrap(
        () => primary.parseNaturalLanguageLog(text),
        () => fallback.parseNaturalLanguageLog(text),
      )
    },

    generateDailyInsight(context: string): Promise<string> {
      return wrap(
        () => primary.generateDailyInsight(context),
        () => fallback.generateDailyInsight(context),
      )
    },
  }
}
