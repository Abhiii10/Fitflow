import type { AIProvider } from './aiProvider'
import type { GenerateWorkoutParams, ModifyWorkoutParams, WeeklyData, WeeklySummary } from './schemas'
import type { ChatMessage, GeneratedPlan, ParsedLogEntry, WorkoutModification } from '@/types'

const BUILT_IN_PLANS: GeneratedPlan[] = [
  {
    name: 'Push Day',
    description: 'Chest, shoulders, triceps',
    dayType: 'heavy',
    cardioTarget: '20 min incline walk',
    daysOfWeek: [1, 4],
    exercises: [
      { name: 'Incline Dumbbell Press', sets: 4, repRangeMin: 6, repRangeMax: 8, restSeconds: 120, rirTarget: 2, formCues: ['Upper chest focus', 'Control the descent'] },
      { name: 'Cable Lateral Raise', sets: 4, repRangeMin: 15, repRangeMax: 20, restSeconds: 60, rirTarget: 1, formCues: ['Lead with elbow', 'No swinging'] },
      { name: 'Overhead Tricep Extension', sets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 75, rirTarget: 1 },
    ],
  },
  {
    name: 'Pull Day',
    description: 'Back and biceps',
    dayType: 'heavy',
    cardioTarget: '20 min incline walk',
    daysOfWeek: [2, 5],
    exercises: [
      { name: 'Pull-Ups', sets: 4, repRangeMin: 6, repRangeMax: 10, restSeconds: 120, rirTarget: 2, formCues: ['Pull elbows down and back', 'Full hang at bottom'] },
      { name: 'Barbell Row', sets: 4, repRangeMin: 6, repRangeMax: 8, restSeconds: 120, rirTarget: 2, formCues: ['Explosive pull', 'Controlled lower'] },
      { name: 'Dumbbell Curl', sets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 60, rirTarget: 1 },
    ],
  },
]

const BUILT_IN_RESPONSES: Record<string, string> = {
  default: "I'm your FitFlow coach. Keep logging workouts, water, protein, steps, and sleep so your dashboard stays useful.",
  workout: 'For your Aesthetic Physique Program, focus on progressive overload. Once you hit the top of your rep range with clean form across all sets, increase weight slightly next session.',
  nutrition: 'Hit 140-160g protein daily. Prioritise whole food sources: chicken, fish, eggs, Greek yogurt. Pre-workout: carbs + salt + water. Post-workout: protein within 1-2 hours.',
  recovery: 'Recovery target: 7-9 hours of sleep. If sleep is low, avoid adding training volume and keep the next session technically clean.',
}

function simulateDelay(ms = 500) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export const mockProvider: AIProvider = {
  name: 'Built-in Coach',
  isMock: true,

  async generateWorkoutPlans(_params: GenerateWorkoutParams): Promise<GeneratedPlan[]> {
    await simulateDelay(700)
    return BUILT_IN_PLANS
  },

  async modifyWorkout(params: ModifyWorkoutParams): Promise<WorkoutModification> {
    await simulateDelay(500)
    return {
      summary: `Adjusted "${params.planName}" for request: "${params.request}".`,
      changes: [
        { original: params.exercises[0]?.name ?? 'First exercise', replacement: 'Modified version', reason: 'Adjusted to match your request' },
      ],
      exercises: params.exercises,
    }
  },

  async generateWeeklySummary(data: WeeklyData): Promise<WeeklySummary> {
    await simulateDelay(500)
    return {
      narrative: `You completed ${data.sessionsCompleted} sessions this week with a ${data.streak}-day streak. Water averaged ${Math.round(data.avgWaterMl)}ml/day.`,
      highlights: [
        data.sessionsCompleted >= 4 ? 'Strong training week' : 'Aim for consistency next week',
        data.avgWaterMl >= 3000 ? 'Hydration on track' : 'Hydration needs attention',
      ],
      recommendations: [
        'Ensure 140-160g protein daily for recovery',
        'Keep 8k+ steps even on rest days',
      ],
      nextWeekFocus: 'Maintain consistency and prioritise sleep for optimal recovery.',
    }
  },

  async parseNaturalLanguageLog(text: string): Promise<ParsedLogEntry[]> {
    await simulateDelay(400)
    const entries: ParsedLogEntry[] = []

    const waterMatch = text.match(/(\d+)\s*ml/i)
    if (waterMatch) {
      entries.push({ type: 'water', data: { amountMl: parseInt(waterMatch[1]) }, description: `${waterMatch[1]}ml water` })
    }

    const proteinMatch = text.match(/(\d+)\s*g?\s*protein/i)
    if (proteinMatch) {
      entries.push({ type: 'protein', data: { amountG: parseInt(proteinMatch[1]) }, description: `${proteinMatch[1]}g protein` })
    }

    const stepsMatch = text.match(/(\d[\d,]+)\s*steps/i)
    if (stepsMatch) {
      const steps = parseInt(stepsMatch[1].replace(',', ''))
      entries.push({ type: 'steps', data: { steps }, description: `${steps.toLocaleString()} steps` })
    }

    if (entries.length === 0) {
      entries.push({
        type: 'water',
        data: { amountMl: 0 },
        description: 'Could not parse that log yet. Try a simple entry like "500ml water" or "40g protein".',
      })
    }

    return entries
  },

  async sendChatMessage(_history: ChatMessage[], message: string, _context: string): Promise<string> {
    await simulateDelay(450)
    const lower = message.toLowerCase()
    if (lower.includes('workout') || lower.includes('exercise') || lower.includes('train')) return BUILT_IN_RESPONSES.workout
    if (lower.includes('protein') || lower.includes('eat') || lower.includes('nutrition')) return BUILT_IN_RESPONSES.nutrition
    if (lower.includes('sleep') || lower.includes('recover') || lower.includes('rest')) return BUILT_IN_RESPONSES.recovery
    return BUILT_IN_RESPONSES.default
  },

  async generateDailyInsight(context: string): Promise<string> {
    await simulateDelay(300)
    if (context.includes('streak: 0')) return "Start your first session today. The Aesthetic Physique Program is designed to build consistency. Check today's plan and get moving."
    return 'Stay consistent with your program. Track your protein, water, and steps daily. Small habits compound into big results.'
  },
}
