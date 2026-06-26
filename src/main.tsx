import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { setAIProvider } from '@/lib/ai/aiProvider'
import { createGroqProvider } from '@/lib/ai/groqProvider'

// AI calls route to /api/ai (Cloudflare Pages Function, co-deployed with the site).
// GROQ_API_KEY lives only in Cloudflare Pages encrypted secrets — never in the frontend.
// Override the endpoint via VITE_AI_WORKER_URL (e.g. for a standalone Worker).
setAIProvider(createGroqProvider())

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
