// FitFlow AI Proxy — Cloudflare Worker
// Keeps AI provider keys server-side. Never exposed to the browser.
//
// Deploy: wrangler publish
// Set secret: wrangler secret put GROQ_API_KEY
//
// The frontend sends requests to VITE_AI_WORKER_URL; this worker
// forwards them to the Groq API using the GROQ_API_KEY secret.

const ALLOWED_ORIGINS = [
  'https://fitflow-74f18.web.app',
  'https://fitflow-74f18.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:5174',
]

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MAX_PROMPT_CHARS = 32_000
const MAX_MESSAGES = 40

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function jsonError(status, message, origin) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return 'messages must be a non-empty array'
  if (messages.length > MAX_MESSAGES) return `messages array exceeds limit of ${MAX_MESSAGES}`
  let totalChars = 0
  for (const m of messages) {
    if (typeof m !== 'object' || m === null) return 'each message must be an object'
    if (!['system', 'user', 'assistant'].includes(m.role)) return `invalid role: ${m.role}`
    if (typeof m.content !== 'string') return 'message content must be a string'
    totalChars += m.content.length
    if (totalChars > MAX_PROMPT_CHARS) return `total prompt length exceeds ${MAX_PROMPT_CHARS} characters`
  }
  return null
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? ''

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (request.method !== 'POST') {
      return jsonError(405, 'Method not allowed', origin)
    }

    if (!env.GROQ_API_KEY) {
      return jsonError(500, 'GROQ_API_KEY secret not configured in worker', origin)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return jsonError(400, 'Invalid JSON body', origin)
    }

    if (!body || typeof body !== 'object') {
      return jsonError(400, 'Request body must be a JSON object', origin)
    }

    const validationError = validateMessages(body.messages)
    if (validationError) {
      return jsonError(400, validationError, origin)
    }

    // Forward to Groq — inject the server-side API key
    let groqRes
    try {
      groqRes = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: body.model ?? 'llama-3.3-70b-versatile',
          messages: body.messages,
          temperature: body.temperature ?? 0.7,
          max_tokens: body.max_tokens ?? 1024,
        }),
      })
    } catch (err) {
      return jsonError(502, `Failed to reach Groq: ${err?.message ?? 'network error'}`, origin)
    }

    const data = await groqRes.json()

    return new Response(JSON.stringify(data), {
      status: groqRes.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    })
  },
}
