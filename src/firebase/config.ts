import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'

export const isConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_API_KEY !== 'your_api_key_here' &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID
)

export { auth, db as firestore }

// Returns the currently signed-in user, or null if not signed in.
// Never signs in automatically — sync is skipped when user is not signed in.
export async function ensureAuth(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub()
      resolve(user && !user.isAnonymous ? user : null)
    })
  })
}

export function getCurrentUser(): User | null {
  const user = auth.currentUser
  return user && !user.isAnonymous ? user : null
}
