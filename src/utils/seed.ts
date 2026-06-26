import { db } from '@/db/db'
import type { WorkoutPlan, Exercise } from '@/types'

const now = Date.now()

function ex(
  id: string,
  planId: string,
  order: number,
  name: string,
  sets: number,
  opts: {
    reps?: number
    repRangeMin?: number
    repRangeMax?: number
    durationSeconds?: number
    restSeconds: number
    rirTarget?: number
    notes?: string
    formCues?: string[]
    targetMuscles?: string[]
    equipment?: string
  }
): Exercise {
  return {
    id,
    planId,
    name,
    sets,
    order,
    updatedAt: now,
    pendingSync: false,
    ...opts,
  }
}

// ─── Workout Plans ────────────────────────────────────────────────────────────

const seedPlans: WorkoutPlan[] = [
  {
    id: 'seed-sun',
    name: 'Back + Triceps (Heavy)',
    description: 'Wide lats, thick back, posture control',
    daysOfWeek: [0],
    dayType: 'heavy',
    cardioTarget: '20 min incline treadmill walk (10–12% grade, 3.5 mph)',
    createdAt: now,
    updatedAt: now,
    pendingSync: false,
  },
  {
    id: 'seed-mon',
    name: 'Delts + Posture + Conditioning (Light)',
    description: 'Side delts, rear delts, posture chain',
    daysOfWeek: [1],
    dayType: 'light',
    cardioTarget: '30 min incline treadmill walk',
    createdAt: now,
    updatedAt: now,
    pendingSync: false,
  },
  {
    id: 'seed-tue',
    name: 'Chest + Biceps (Heavy)',
    description: 'Upper chest emphasis, arm peak',
    daysOfWeek: [2],
    dayType: 'heavy',
    cardioTarget: '20 min incline treadmill walk',
    createdAt: now,
    updatedAt: now,
    pendingSync: false,
  },
  {
    id: 'seed-wed',
    name: 'Active Recovery + Abs (Light)',
    description: 'Core, mobility, 10k steps target',
    daysOfWeek: [3],
    dayType: 'active-recovery',
    cardioTarget: '30–40 min walk or 10k steps',
    createdAt: now,
    updatedAt: now,
    pendingSync: false,
  },
  {
    id: 'seed-thu',
    name: 'Legs + Abs (Heavy)',
    description: 'Quads, hamstrings, glutes, visible abs',
    daysOfWeek: [4],
    dayType: 'heavy',
    cardioTarget: '15–20 min incline treadmill walk',
    createdAt: now,
    updatedAt: now,
    pendingSync: false,
  },
  {
    id: 'seed-fri',
    name: 'Upper Aesthetic Pump (Light)',
    description: 'Chest, back, delts — high rep pump work',
    daysOfWeek: [5],
    dayType: 'light',
    cardioTarget: '25 min incline treadmill walk',
    createdAt: now,
    updatedAt: now,
    pendingSync: false,
  },
  {
    id: 'seed-sat',
    name: 'Full Rest',
    description: '8k–12k steps, mobility, prioritise sleep',
    daysOfWeek: [6],
    dayType: 'rest',
    cardioTarget: '8k–12k casual steps, no structured cardio',
    createdAt: now,
    updatedAt: now,
    pendingSync: false,
  },
]

// ─── Sunday: Back + Triceps (Heavy) ─────────────────────────────────────────

const sunExercises: Exercise[] = [
  ex('sun-1', 'seed-sun', 0, 'Wide-Grip Pull-Up', 4, {
    repRangeMin: 6, repRangeMax: 8, restSeconds: 120, rirTarget: 2,
    formCues: ['Full hang at bottom', 'Pull elbows to hips', 'Slight forward lean for lat stretch'],
    targetMuscles: ['Lats', 'Biceps', 'Rear Delt'],
  }),
  ex('sun-2', 'seed-sun', 1, 'Barbell Bent-Over Row (Underhand)', 4, {
    repRangeMin: 6, repRangeMax: 8, restSeconds: 120, rirTarget: 2,
    formCues: ['Hinge until torso ~45°', 'Drive elbows to hips', 'Squeeze at top'],
    targetMuscles: ['Lats', 'Rhomboids', 'Biceps'],
  }),
  ex('sun-3', 'seed-sun', 2, 'Seated Cable Row (Narrow Grip)', 3, {
    repRangeMin: 10, repRangeMax: 12, restSeconds: 90, rirTarget: 1,
    formCues: ['Chest tall', 'Retract scapula before pulling arms', 'Full stretch forward'],
    targetMuscles: ['Mid Back', 'Lats'],
  }),
  ex('sun-4', 'seed-sun', 3, 'Single-Arm Dumbbell Row', 3, {
    repRangeMin: 10, repRangeMax: 12, restSeconds: 75, rirTarget: 1,
    formCues: ['Brace against bench', 'Elbow tight to body', 'Rotate slightly at top'],
    targetMuscles: ['Lats', 'Mid Back'],
  }),
  ex('sun-5', 'seed-sun', 4, 'Face Pull (Cable)', 3, {
    repRangeMin: 15, repRangeMax: 20, restSeconds: 60, rirTarget: 0,
    formCues: ['Pull to forehead level', 'External rotate at end', 'Light weight, full control'],
    targetMuscles: ['Rear Delt', 'Rotator Cuff'],
  }),
  ex('sun-6', 'seed-sun', 5, 'Overhead Tricep Extension (Cable/EZ)', 3, {
    repRangeMin: 10, repRangeMax: 12, restSeconds: 75, rirTarget: 1,
    formCues: ['Elbows close to head', 'Full stretch overhead', 'Lock out at bottom'],
    targetMuscles: ['Triceps Long Head'],
  }),
  ex('sun-7', 'seed-sun', 6, 'Tricep Pushdown (Rope)', 3, {
    repRangeMin: 12, repRangeMax: 15, restSeconds: 60, rirTarget: 0,
    formCues: ['Separate rope at bottom', 'Elbows locked at sides', 'Control the return'],
    targetMuscles: ['Triceps Lateral Head'],
  }),
]

// ─── Monday: Delts + Posture + Conditioning (Light) ─────────────────────────

const monExercises: Exercise[] = [
  ex('mon-1', 'seed-mon', 0, 'Dumbbell Lateral Raise', 4, {
    repRangeMin: 15, repRangeMax: 20, restSeconds: 60, rirTarget: 1,
    formCues: ['Lead with elbow, not wrist', 'Slight forward lean', 'Thumb slightly down at top', 'No swinging'],
    targetMuscles: ['Lateral Delt'],
  }),
  ex('mon-2', 'seed-mon', 1, 'Cable Lateral Raise (Single Arm)', 3, {
    repRangeMin: 15, repRangeMax: 20, restSeconds: 60, rirTarget: 0,
    formCues: ['Cable from opposite hip', 'Maintain elbow bend', 'Pause at top'],
    targetMuscles: ['Lateral Delt'],
  }),
  ex('mon-3', 'seed-mon', 2, 'Seated Dumbbell Press (Arnold)', 3, {
    repRangeMin: 10, repRangeMax: 12, restSeconds: 90, rirTarget: 2,
    formCues: ['Rotate palms as you press', 'Controlled descent', 'Avoid locking out fully'],
    targetMuscles: ['Front Delt', 'Lateral Delt'],
  }),
  ex('mon-4', 'seed-mon', 3, 'Reverse Pec Deck / Rear Delt Fly', 3, {
    repRangeMin: 15, repRangeMax: 20, restSeconds: 60, rirTarget: 0,
    formCues: ['Arms at shoulder height', 'Slight elbow bend', 'Squeeze rear delts at end range'],
    targetMuscles: ['Rear Delt', 'Rhomboids'],
  }),
  ex('mon-5', 'seed-mon', 4, 'Band Pull-Apart', 3, {
    repRangeMin: 20, repRangeMax: 25, restSeconds: 45, rirTarget: 0,
    formCues: ['Arms straight', 'Pull to chest level', 'Squeeze shoulder blades together'],
    targetMuscles: ['Rear Delt', 'Rhomboids'],
  }),
  ex('mon-6', 'seed-mon', 5, 'Dead Bug (Core)', 3, {
    repRangeMin: 8, repRangeMax: 10, restSeconds: 60, rirTarget: 1,
    notes: 'Each side',
    formCues: ['Press lower back into floor', 'Exhale on extension', 'Never lose lumbar contact'],
    targetMuscles: ['Transverse Abdominis', 'Core'],
  }),
  ex('mon-7', 'seed-mon', 6, 'Cat-Cow + Thoracic Rotation', 3, {
    durationSeconds: 60, restSeconds: 30,
    formCues: ['Slow and controlled', 'Full range each direction', 'Breathe into each stretch'],
    targetMuscles: ['Spine', 'Thoracic Mobility'],
  }),
]

// ─── Tuesday: Chest + Biceps (Heavy) ─────────────────────────────────────────

const tueExercises: Exercise[] = [
  ex('tue-1', 'seed-tue', 0, 'Incline Barbell Press', 4, {
    repRangeMin: 6, repRangeMax: 8, restSeconds: 120, rirTarget: 2,
    formCues: ['Bench at 30–45°', 'Bar to upper chest', 'Slight arch, glutes on bench', 'Full ROM'],
    targetMuscles: ['Upper Chest', 'Front Delt', 'Triceps'],
  }),
  ex('tue-2', 'seed-tue', 1, 'Incline Dumbbell Press', 3, {
    repRangeMin: 8, repRangeMax: 10, restSeconds: 90, rirTarget: 2,
    formCues: ['Elbows slightly in', 'Full stretch at bottom', 'Press to inside of top'],
    targetMuscles: ['Upper Chest', 'Front Delt'],
  }),
  ex('tue-3', 'seed-tue', 2, 'Cable Crossover (High to Low)', 3, {
    repRangeMin: 12, repRangeMax: 15, restSeconds: 75, rirTarget: 1,
    formCues: ['Slight forward lean', 'Meet hands below chest', 'Feel stretch through pec'],
    targetMuscles: ['Lower Chest', 'Chest'],
  }),
  ex('tue-4', 'seed-tue', 3, 'Pec Deck / Machine Fly', 3, {
    repRangeMin: 12, repRangeMax: 15, restSeconds: 60, rirTarget: 0,
    formCues: ['Seat so elbows at shoulder height', 'Open wide for stretch', 'Squeeze at midline'],
    targetMuscles: ['Chest'],
  }),
  ex('tue-5', 'seed-tue', 4, 'Barbell Curl', 3, {
    repRangeMin: 8, repRangeMax: 10, restSeconds: 90, rirTarget: 2,
    formCues: ['Elbows at sides, no swinging', 'Supinate at top', 'Full extension at bottom'],
    targetMuscles: ['Biceps'],
  }),
  ex('tue-6', 'seed-tue', 5, 'Incline Dumbbell Curl', 3, {
    repRangeMin: 10, repRangeMax: 12, restSeconds: 75, rirTarget: 1,
    formCues: ['Bench at 45°', 'Arms hang fully before curling', 'Maximum stretch for peak'],
    targetMuscles: ['Biceps Long Head'],
  }),
  ex('tue-7', 'seed-tue', 6, 'Hammer Curl', 2, {
    repRangeMin: 12, repRangeMax: 15, restSeconds: 60, rirTarget: 0,
    formCues: ['Neutral grip', 'Controlled tempo', 'Builds brachialis thickness'],
    targetMuscles: ['Brachialis', 'Brachioradialis'],
  }),
]

// ─── Wednesday: Active Recovery + Abs ─────────────────────────────────────────

const wedExercises: Exercise[] = [
  ex('wed-1', 'seed-wed', 0, 'Cable Crunch', 3, {
    repRangeMin: 15, repRangeMax: 20, restSeconds: 60, rirTarget: 0,
    formCues: ['Hinge at waist not neck', 'Contract abs at bottom', 'Slow eccentric'],
    targetMuscles: ['Rectus Abdominis'],
  }),
  ex('wed-2', 'seed-wed', 1, 'Hanging Leg Raise', 3, {
    repRangeMin: 10, repRangeMax: 15, restSeconds: 75, rirTarget: 1,
    formCues: ['Posterior pelvic tilt at top', 'No swinging', 'Control the descent'],
    targetMuscles: ['Lower Abs', 'Hip Flexors'],
  }),
  ex('wed-3', 'seed-wed', 2, 'Ab Wheel Rollout', 3, {
    repRangeMin: 8, repRangeMax: 10, restSeconds: 75, rirTarget: 1,
    formCues: ['Brace hard before rolling', 'Stop before lower back rounds', 'Pull back with abs'],
    targetMuscles: ['Core', 'Transverse Abdominis'],
  }),
  ex('wed-4', 'seed-wed', 3, 'Side Plank', 3, {
    durationSeconds: 45, restSeconds: 45,
    notes: 'Each side',
    formCues: ['Hip high, body straight', 'Drive hips up, not just hold', 'Breathing stays steady'],
    targetMuscles: ['Obliques', 'Core'],
  }),
  ex('wed-5', 'seed-wed', 4, 'Hip Flexor Stretch + Mobility Flow', 1, {
    durationSeconds: 300, restSeconds: 0,
    formCues: ['90/90 stretch', 'Pigeon pose', "World's greatest stretch", 'Move slowly'],
    targetMuscles: ['Hip Flexors', 'Thoracic Spine'],
  }),
]

// ─── Thursday: Legs + Abs (Heavy) ────────────────────────────────────────────

const thuExercises: Exercise[] = [
  ex('thu-1', 'seed-thu', 0, 'Barbell Back Squat', 4, {
    repRangeMin: 6, repRangeMax: 8, restSeconds: 150, rirTarget: 2,
    formCues: ['Knees track toes', 'Depth below parallel', 'Chest tall', 'Drive through heels'],
    targetMuscles: ['Quads', 'Glutes', 'Core'],
  }),
  ex('thu-2', 'seed-thu', 1, 'Romanian Deadlift', 3, {
    repRangeMin: 8, repRangeMax: 10, restSeconds: 120, rirTarget: 2,
    formCues: ['Hinge until hamstrings fully stretched', 'Bar stays close to legs', 'Drive hips forward'],
    targetMuscles: ['Hamstrings', 'Glutes', 'Spinal Erectors'],
  }),
  ex('thu-3', 'seed-thu', 2, 'Leg Press (High & Wide Foot)', 3, {
    repRangeMin: 10, repRangeMax: 12, restSeconds: 90, rirTarget: 1,
    formCues: ['Full range — knees near chest', 'Don\'t lock out at top', 'Control descent'],
    targetMuscles: ['Glutes', 'Quads', 'Hamstrings'],
  }),
  ex('thu-4', 'seed-thu', 3, 'Leg Curl (Machine)', 3, {
    repRangeMin: 10, repRangeMax: 12, restSeconds: 75, rirTarget: 1,
    formCues: ['Hips down, no rise', 'Full ROM', 'Pause at contraction'],
    targetMuscles: ['Hamstrings'],
  }),
  ex('thu-5', 'seed-thu', 4, 'Bulgarian Split Squat', 3, {
    repRangeMin: 8, repRangeMax: 10, restSeconds: 90, rirTarget: 1,
    notes: 'Each leg. Use dumbbells or barbell.',
    formCues: ['Rear foot elevated 15–20"', 'Torso upright', 'Front knee tracks over toes'],
    targetMuscles: ['Quads', 'Glutes'],
  }),
  ex('thu-6', 'seed-thu', 5, 'Standing Calf Raise', 4, {
    repRangeMin: 12, repRangeMax: 15, restSeconds: 60, rirTarget: 0,
    formCues: ['Full stretch at bottom', 'Pause at top', 'Slow eccentric for growth'],
    targetMuscles: ['Gastrocnemius', 'Soleus'],
  }),
  ex('thu-7', 'seed-thu', 6, 'Cable Crunch', 3, {
    repRangeMin: 15, repRangeMax: 20, restSeconds: 60, rirTarget: 0,
    formCues: ['Hinge at waist', 'Round fully at bottom', 'Slow on the way back up'],
    targetMuscles: ['Rectus Abdominis'],
  }),
]

// ─── Friday: Upper Aesthetic Pump (Light) ────────────────────────────────────

const friExercises: Exercise[] = [
  ex('fri-1', 'seed-fri', 0, 'Cable Fly (Mid Height)', 3, {
    repRangeMin: 15, repRangeMax: 20, restSeconds: 60, rirTarget: 0,
    formCues: ['Slight forward lean', 'Arms slightly bent', 'Full stretch, squeeze midline'],
    targetMuscles: ['Chest'],
  }),
  ex('fri-2', 'seed-fri', 1, 'Lat Pulldown (Wide Grip)', 3, {
    repRangeMin: 12, repRangeMax: 15, restSeconds: 75, rirTarget: 1,
    formCues: ['Lean back slightly', 'Bar to upper chest', 'Pull elbows down and back'],
    targetMuscles: ['Lats', 'Biceps'],
  }),
  ex('fri-3', 'seed-fri', 2, 'Dumbbell Lateral Raise (Drop Set)', 3, {
    repRangeMin: 15, repRangeMax: 20, restSeconds: 60, rirTarget: 0,
    notes: 'Drop weight by 30–40% and continue for 10 more reps on last set',
    formCues: ['Lead with elbow', 'Thumb slightly down at peak'],
    targetMuscles: ['Lateral Delt'],
  }),
  ex('fri-4', 'seed-fri', 3, 'Machine Row (Chest Supported)', 3, {
    repRangeMin: 12, repRangeMax: 15, restSeconds: 75, rirTarget: 1,
    formCues: ['Chest on pad', 'Full stretch forward', 'Retract scapula then pull'],
    targetMuscles: ['Mid Back', 'Lats'],
  }),
  ex('fri-5', 'seed-fri', 4, 'EZ Bar Curl', 3, {
    repRangeMin: 12, repRangeMax: 15, restSeconds: 60, rirTarget: 0,
    formCues: ['Controlled tempo', 'Full ROM', 'Don\'t lean back'],
    targetMuscles: ['Biceps'],
  }),
  ex('fri-6', 'seed-fri', 5, 'Tricep Pushdown (Straight Bar)', 3, {
    repRangeMin: 15, repRangeMax: 20, restSeconds: 60, rirTarget: 0,
    formCues: ['Elbows at sides', 'Lock out at bottom', 'Control return'],
    targetMuscles: ['Triceps'],
  }),
  ex('fri-7', 'seed-fri', 6, 'Face Pull', 3, {
    repRangeMin: 20, repRangeMax: 25, restSeconds: 45, rirTarget: 0,
    formCues: ['High cable', 'Pull to forehead', 'External rotate at end'],
    targetMuscles: ['Rear Delt', 'Rotator Cuff'],
  }),
]

// ─── Saturday: Rest (no exercises) ───────────────────────────────────────────
// No exercises — rest day. Users log steps manually.

// ─── Seed Function ────────────────────────────────────────────────────────────

export async function seedIfEmpty(): Promise<void> {
  const existingPlans = await db.workoutPlans.count()
  if (existingPlans > 0) return

  await db.workoutPlans.bulkPut(seedPlans)
  await db.exercises.bulkPut([
    ...sunExercises,
    ...monExercises,
    ...tueExercises,
    ...wedExercises,
    ...thuExercises,
    ...friExercises,
  ])
}
