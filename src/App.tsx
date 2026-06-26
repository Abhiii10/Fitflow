import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Navigation } from '@/components/Navigation'
import { OfflineBanner } from '@/components/OfflineBanner'
import { PWAUpdateBanner } from '@/components/PWAUpdateBanner'
import { RoutineReminder } from '@/components/RoutineReminder'
import { Dashboard } from '@/pages/Dashboard'
import { Today } from '@/pages/Today'
import { Calendar } from '@/pages/Calendar'
import { Water } from '@/pages/Water'
import { Nutrition } from '@/pages/Nutrition'
import { StepsCardio } from '@/pages/StepsCardio'
import { Workouts } from '@/pages/Workouts'
import { WorkoutDetail } from '@/pages/WorkoutDetail'
import { WorkoutBuilder } from '@/pages/WorkoutBuilder'
import { ActiveSession } from '@/pages/ActiveSession'
import { History } from '@/pages/History'
import { Settings } from '@/pages/Settings'
import { AICoach } from '@/pages/AICoach'
import { ExerciseLibrary } from '@/pages/ExerciseLibrary'
import { ExerciseDetail } from '@/pages/ExerciseDetail'
import { WeeklyCheckIn } from '@/pages/WeeklyCheckIn'
import { Progress } from '@/pages/Progress'
import { useStore } from '@/store/useStore'
import { useSync } from '@/hooks/useSync'
import { useAuth } from '@/hooks/useAuth'
import { getProfile, getActiveSession, seedRoutineItems } from '@/db/db'
import { seedIfEmpty } from '@/utils/seed'

function AppInner() {
  const { setProfile, setActiveSession } = useStore()
  useSync()
  useAuth() // subscribes to Firebase auth state and syncs to store

  useEffect(() => {
    async function init() {
      await seedIfEmpty()
      await seedRoutineItems()
      const profile = await getProfile()
      setProfile(profile)
      const session = await getActiveSession()
      if (session) setActiveSession(session)
    }
    init()
  }, [setProfile, setActiveSession])

  return (
    <div className="min-h-screen bg-cyber-black text-cyber-text">
      <PWAUpdateBanner />
      <OfflineBanner />
      <main className="pb-20" style={{ paddingTop: 'env(safe-area-inset-top, 44px)' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/today" element={<Today />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/water" element={<Water />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/steps" element={<StepsCardio />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/workouts/new" element={<WorkoutBuilder />} />
          <Route path="/workouts/:id" element={<WorkoutDetail />} />
          <Route path="/workouts/:id/edit" element={<WorkoutBuilder />} />
          <Route path="/session" element={<ActiveSession />} />
          <Route path="/history" element={<History />} />
          <Route path="/exercises" element={<ExerciseLibrary />} />
          <Route path="/exercises/:name" element={<ExerciseDetail />} />
          <Route path="/checkin" element={<WeeklyCheckIn />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/ai" element={<AICoach />} />
          <Route path="/__/auth/handler" element={<Settings />} />
          <Route path="*" element={<Settings />} />
        </Routes>
      </main>
      <RoutineReminder />
      <Navigation />
    </div>
  )
}

export default function App() {
  return <AppInner />
}
