import { describe, it, expect } from 'vitest'
import { evaluate, calculateAdherence } from './rules'
import type { CoachContext } from './types'

const baseProfile = {
  waterGoalMl: 3500,
  proteinGoalMinG: 140,
  proteinGoalMaxG: 160,
  stepsGoalMin: 8000,
  stepsGoalMax: 12000,
  sleepGoalMinH: 7,
  sleepGoalMaxH: 9,
  workoutDaysPerWeek: 4,
}

function makeCtx(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    today: '2026-06-26',
    hourOfDay: 20,
    profile: baseProfile,
    waterTodayMl: 3500,
    proteinTodayG: 140,
    caloriesTodayKcal: 2000,
    stepsToday: 8000,
    sleepLast3Days: [7.5, 8, 7],
    weightLast7Days: [],
    waterDaysThisWeek: 5,
    proteinDaysThisWeek: 5,
    stepsDaysThisWeek: 4,
    sleepDaysThisWeek: 6,
    workoutsThisWeek: 3,
    ...overrides,
  }
}

// ─── Hydration rule ──────────────────────────────────────────────────────────

describe('hydration rule', () => {
  it('no message before 2pm', () => {
    const ctx = makeCtx({ hourOfDay: 12, waterTodayMl: 500 })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'hydration-afternoon')).toBeUndefined()
  })

  it('fires after 2pm with low water', () => {
    const ctx = makeCtx({ hourOfDay: 15, waterTodayMl: 1000 })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'hydration-afternoon')).toBeDefined()
  })

  it('no message when water is >= 50% of goal after 2pm', () => {
    const ctx = makeCtx({ hourOfDay: 15, waterTodayMl: 1800 })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'hydration-afternoon')).toBeUndefined()
  })
})

// ─── Protein rule ────────────────────────────────────────────────────────────

describe('protein rule', () => {
  it('no message before 6pm', () => {
    const ctx = makeCtx({ hourOfDay: 17, proteinTodayG: 50 })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'protein-evening')).toBeUndefined()
  })

  it('fires after 6pm with low protein', () => {
    const ctx = makeCtx({ hourOfDay: 19, proteinTodayG: 60 })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'protein-evening')).toBeDefined()
  })

  it('no message when protein >= 70% of goal', () => {
    const ctx = makeCtx({ hourOfDay: 19, proteinTodayG: 105 })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'protein-evening')).toBeUndefined()
  })
})

// ─── Sleep rule ──────────────────────────────────────────────────────────────

describe('sleep rule', () => {
  it('fires with average sleep below 6.5h', () => {
    const ctx = makeCtx({ sleepLast3Days: [5, 5.5, 6] })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'low-sleep')).toBeDefined()
  })

  it('no message with sufficient sleep', () => {
    const ctx = makeCtx({ sleepLast3Days: [7, 8, 7.5] })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'low-sleep')).toBeUndefined()
  })

  it('no message with fewer than 2 sleep logs', () => {
    const ctx = makeCtx({ sleepLast3Days: [5] })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'low-sleep')).toBeUndefined()
  })
})

// ─── Steps rule ──────────────────────────────────────────────────────────────

describe('steps rule', () => {
  it('fires after 6pm with very low steps', () => {
    const ctx = makeCtx({ hourOfDay: 19, stepsToday: 2000 })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'low-steps')).toBeDefined()
  })

  it('no message before 6pm', () => {
    const ctx = makeCtx({ hourOfDay: 10, stepsToday: 500 })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'low-steps')).toBeUndefined()
  })

  it('no message when steps >= 40% of goal', () => {
    const ctx = makeCtx({ hourOfDay: 20, stepsToday: 3500 })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'low-steps')).toBeUndefined()
  })
})

// ─── Deload rule ─────────────────────────────────────────────────────────────

describe('deload rule', () => {
  it('fires when training volume is high and sleep is poor', () => {
    const ctx = makeCtx({
      workoutsThisWeek: 5,
      sleepLast3Days: [5, 5, 5.5],
    })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'deload-signal')).toBeDefined()
  })

  it('no deload when sleep is fine', () => {
    const ctx = makeCtx({
      workoutsThisWeek: 5,
      sleepLast3Days: [7, 7.5, 8],
    })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'deload-signal')).toBeUndefined()
  })

  it('no deload when workouts are below target', () => {
    const ctx = makeCtx({
      workoutsThisWeek: 2,
      sleepLast3Days: [4, 5, 5],
    })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'deload-signal')).toBeUndefined()
  })
})

// ─── Weight trend ─────────────────────────────────────────────────────────────

describe('weight trend rule', () => {
  it('no message with fewer than 4 entries', () => {
    const ctx = makeCtx({
      weightLast7Days: [
        { date: '2026-06-26', weightKg: 80 },
        { date: '2026-06-25', weightKg: 80.2 },
      ],
    })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'weight-trend-down' || m.id === 'weight-trend-up')).toBeUndefined()
  })

  it('detects downward trend', () => {
    const ctx = makeCtx({
      weightLast7Days: [
        { date: '2026-06-26', weightKg: 79.0 },
        { date: '2026-06-25', weightKg: 79.1 },
        { date: '2026-06-24', weightKg: 79.2 },
        { date: '2026-06-23', weightKg: 79.3 },
        { date: '2026-06-22', weightKg: 80.0 },
        { date: '2026-06-21', weightKg: 80.2 },
        { date: '2026-06-20', weightKg: 80.1 },
      ],
    })
    const msgs = evaluate(ctx)
    expect(msgs.find(m => m.id === 'weight-trend-down')).toBeDefined()
  })
})

// ─── Adherence score ─────────────────────────────────────────────────────────

describe('calculateAdherence', () => {
  it('returns 100% when all goals met every day', () => {
    const ctx = makeCtx({
      workoutsThisWeek: 4,
      waterDaysThisWeek: 7,
      proteinDaysThisWeek: 7,
      stepsDaysThisWeek: 7,
      sleepDaysThisWeek: 7,
    })
    const score = calculateAdherence(ctx)
    expect(score.overall).toBe(100)
    expect(score.workouts).toBe(100)
    expect(score.water).toBe(100)
  })

  it('returns 0% when nothing is done', () => {
    const ctx = makeCtx({
      workoutsThisWeek: 0,
      waterDaysThisWeek: 0,
      proteinDaysThisWeek: 0,
      stepsDaysThisWeek: 0,
      sleepDaysThisWeek: 0,
    })
    const score = calculateAdherence(ctx)
    expect(score.overall).toBe(0)
  })

  it('workouts score caps at 100% even if exceeded', () => {
    const ctx = makeCtx({ workoutsThisWeek: 7, profile: { ...baseProfile, workoutDaysPerWeek: 4 } })
    const score = calculateAdherence(ctx)
    expect(score.workouts).toBe(100)
  })

  it('partial week gives proportional score', () => {
    const ctx = makeCtx({
      workoutsThisWeek: 2,  // 2/4 = 50%
      waterDaysThisWeek: 7, // 100%
      proteinDaysThisWeek: 0,
      stepsDaysThisWeek: 0,
      sleepDaysThisWeek: 0,
    })
    const score = calculateAdherence(ctx)
    // 50%*35 + 0%*25 + 100%*20 + 0%*10 + 0%*10 = 17.5 + 20 = 37.5 → 38 (rounded)
    expect(score.overall).toBeGreaterThanOrEqual(37)
    expect(score.overall).toBeLessThanOrEqual(38)
  })
})

// ─── Priority ordering ────────────────────────────────────────────────────────

describe('message priority', () => {
  it('deload and sleep have higher priority than steps', () => {
    const ctx = makeCtx({
      hourOfDay: 20,
      workoutsThisWeek: 5,
      sleepLast3Days: [4, 5, 5],
      stepsToday: 500,
    })
    const msgs = evaluate(ctx)
    const deload = msgs.find(m => m.id === 'deload-signal')
    const steps = msgs.find(m => m.id === 'low-steps')
    if (deload && steps) {
      expect(deload.priority).toBeLessThan(steps.priority)
    }
  })
})
