import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseHostingDomains = ['fitflow-74f18.web.app', 'fitflow-74f18.firebaseapp.com']
const runtimeAuthDomain = firebaseHostingDomains.includes(window.location.hostname)
  ? window.location.hostname
  : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: runtimeAuthDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

export const analyticsPromise = isSupported().then((supported) =>
  supported ? getAnalytics(app) : null
)
