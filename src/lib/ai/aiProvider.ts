import type {
  ChatMessage, GeneratedPlan, ParsedLogEntry, WorkoutModification,
} from '@/types'
import type {
  GenerateWorkoutParams, ModifyWorkoutParams, WeeklyData, WeeklySummary,
} from './schemas'

export interface AIProvider {
  generateWorkoutPlans(params: GenerateWorkoutParams): Promise<GeneratedPlan[]>
  modifyWorkout(params: ModifyWorkoutParams): Promise<WorkoutModification>
  generateWeeklySummary(data: WeeklyData): Promise<WeeklySummary>
  parseNaturalLanguageLog(text: string): Promise<ParsedLogEntry[]>
  sendChatMessage(history: ChatMessage[], message: string, context: string): Promise<string>
  generateDailyInsight(context: string): Promise<string>
  readonly name: string
  readonly isMock: boolean
}

let _provider: AIProvider | null = null

export function setAIProvider(p: AIProvider) {
  _provider = p
}

export function getAIProvider(): AIProvider {
  if (!_provider) throw new Error('AI provider not initialised')
  return _provider
}
