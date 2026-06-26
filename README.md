# FitFlow

**Personal offline-first fitness tracker — $0 to operate**

React + TypeScript + Vite + Dexie/IndexedDB + Firebase (optional sync) + Cloudflare Pages Functions (optional AI).
Works 100% offline. All data is local first.

---

## Quick Start

```bash
npm install
cp .env.example .env
# Fill in your Firebase config in .env (optional — app works without it)
npm run dev
```

Open `http://localhost:5173`

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server at localhost:5173 |
| `npm run build` | TypeScript check + Vite production build |
| `npm run typecheck` | TypeScript check only (no build) |
| `npm run test` | Run Vitest unit tests (one-shot) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run preview` | Preview the production build locally |

---

## Architecture

```
Device (always works)
└── IndexedDB (Dexie) ← primary source of truth
    ├── All 19 tables defined in src/db/db.ts
    └── Table registry at src/data/tableRegistry.ts

Cloud sync (optional — requires sign-in)
└── Firebase Firestore ← sync only, not primary
    ├── Structured records only (no photo blobs)
    └── Conflict resolution: version > updatedAtServer > updatedAt

AI proxy (optional — co-deployed with the site)
└── functions/api/ai.ts ← Cloudflare Pages Function
    ├── Holds GROQ_API_KEY as a Cloudflare Pages encrypted secret
    └── Frontend calls /api/ai (same-origin, no separate deployment)
```

### What syncs, what stays local

| Table | Backup | Firestore Sync | Notes |
|---|---|---|---|
| profile | ✓ | ✓ | Goals, settings |
| waterLogs | ✓ | ✓ | |
| proteinLogs | ✓ | ✓ | |
| macroLogs | ✓ | ✓ | Calories, macros |
| stepLogs | ✓ | ✓ | |
| cardioLogs | ✓ | ✓ | |
| sleepLogs | ✓ | ✓ | |
| weightLogs | ✓ | ✓ | |
| photoLogs | ✓ | metadata only | dataUrl stays local — too large for Firestore |
| workoutPlans | ✓ | ✓ | |
| exercises | ✓ | ✓ | |
| workoutSessions | ✓ | ✓ | |
| sessionExerciseLogs | ✓ | ✓ | |
| weeklyCheckIns | ✓ | ✓ | |
| routineItems | ✓ | ✓ | |
| aiGeneratedDrafts | ✓ | ✓ | |
| exerciseDemos | ✓ | local only | App-seeded static data |
| activeSession | — | local only | In-progress workout |
| syncQueue | — | local only | Internal bookkeeping |

---

## Environment Variables

Only these belong in `.env` (see `.env.example`):

```env
# Firebase public config (safe in frontend — public keys by design)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...

# AI endpoint override — optional.
# Defaults to /api/ai (Cloudflare Pages Function, no config needed).
# Only set this if you use a standalone Cloudflare Worker instead.
# VITE_AI_WORKER_URL=https://your-worker.workers.dev
```

**NEVER put these in `.env`:**
- `VITE_GROQ_API_KEY` — bundled into browser JS, anyone can read it
- `VITE_GEMINI_API_KEY` — same problem
- `VITE_OPENROUTER_API_KEY` — same problem

AI provider keys go only in Cloudflare Pages encrypted secrets (see below).

---

## Optional: Firebase Setup

The app works fully offline without Firebase. To enable cloud sync:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com) (Spark free plan)
2. Enable **Authentication** → Anonymous + Google sign-in
3. Enable **Firestore Database** → Production mode
4. Deploy Firestore rules:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules
   ```
5. Add your Firebase config to `.env`

---

## Deployment: Cloudflare Pages (recommended)

The app and the AI proxy are deployed together as a single Cloudflare Pages project.
No separate Worker deployment is needed.

### Build settings (set in Cloudflare Pages dashboard)

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | 20 or 22 |

### AI setup (optional)

The Pages Function at `functions/api/ai.ts` handles `/api/ai` requests.
It reads `GROQ_API_KEY` from Cloudflare Pages encrypted secrets — the key never touches the browser.

To enable real AI responses:

1. In the Cloudflare Pages project dashboard → **Settings → Environment variables**
2. Click **Add variable** → name it `GROQ_API_KEY`, paste your Groq key, and check **Encrypt**
3. Redeploy the site — the function picks up the secret automatically

The frontend always calls `/api/ai` (relative URL). No `VITE_AI_WORKER_URL` configuration needed.

### Local development with AI

For local dev, `npm run dev` serves the Vite app but not the Pages Function.
AI calls to `/api/ai` will 404 locally — the app handles this gracefully (AI features show an error, everything else works offline).

For full local AI testing:
```bash
# Build first, then run Cloudflare Pages dev server
npm run build
npx wrangler pages dev dist
# Create .dev.vars with: GROQ_API_KEY=your_key_here
```

### Rotating a compromised AI key

1. Revoke the old key at [console.groq.com](https://console.groq.com)
2. Generate a new key
3. Cloudflare Pages dashboard → Settings → Environment variables → update `GROQ_API_KEY`
4. Redeploy — no code change needed

---

## Alternative: Firebase Hosting

```bash
npm run build
firebase deploy
```

Note: Firebase Hosting doesn't support serverless functions on the Spark free plan,
so the AI proxy won't work. The app functions fully offline without it.

---

## Backup & Restore

The app has a built-in JSON backup system (Settings → Backup & Restore).

**Export:** Downloads a versioned JSON file with all 17 backup-eligible tables.
Photo blobs are included as base64 strings — the file may be large if you have many photos.

**Import:** Validates the backup format and record shapes before writing. Creates a
pre-import safety backup automatically before overwriting local data.

**Why photos aren't in Firestore:** Firestore documents have a 1 MB limit and every
read/write costs money. Progress photos are included in the local JSON backup instead.

---

## Coach Engine (local, no AI required)

The rule-based coach at `src/coach/` analyzes your local data and generates messages:

- Hydration gap after 2pm
- Protein gap after 6pm
- Low sleep warning (avg < 6.5h over 3 days)
- Low steps alert after 6pm
- Deload signal (high volume + poor sleep)
- Weekly weight trend
- Adherence score (workouts 35%, protein 25%, water 20%, steps 10%, sleep 10%)

Run the tests: `npm test`

---

## iOS / iPhone (PWA)

1. Open the app URL in **Safari**
2. Share → Add to Home Screen
3. Sign in with Google from Settings (use Safari, not the PWA context, for Google sign-in)

---

## Security Notes

- Firebase public config (`VITE_FIREBASE_*`) is safe in the frontend by design
- AI provider keys (`GROQ_API_KEY` etc.) must ONLY be in Cloudflare Pages encrypted secrets
- `.env` is gitignored and should never be committed
- Firestore rules enforce: authenticated users can only read/write their own data
- Delete is always denied — soft deletes via `deletedAt` field only
- Progress photo blobs are explicitly blocked from reaching Firestore (enforced in rules + code)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (dark cyber theme) |
| Local DB | Dexie.js (IndexedDB) — offline-first, schema v8 |
| State | Zustand |
| Routing | React Router v6 |
| Auth | Firebase Anonymous + Google Sign-In |
| Cloud Sync | Firebase Firestore (optional) |
| AI Proxy | Cloudflare Pages Functions (co-deployed, optional) |
| PWA | vite-plugin-pwa + Workbox |
| Dates | date-fns |
| Charts | Recharts |
| Testing | Vitest |

---

## Cost

**$0 to operate.** Constraints maintained:
- Firebase Spark (free) only — no Blaze required
- No Firebase Cloud Functions, no Firebase Storage
- No paid nutrition APIs, no paid analytics
- No Apple Health, no paid hosting required
- Cloudflare Pages: free tier (500 builds/month, unlimited requests)
- Cloudflare Pages Functions: 100,000 invocations/day free — enough for personal use
