// Cloudflare Pages Function — POST /api/ai
// Co-deployed with the static site; no separate Worker deployment needed.
// GROQ_API_KEY must be set as an encrypted secret in Cloudflare Pages project settings.
// The frontend never sees this key — it only calls /api/ai (relative URL, same origin).

interface Env {
  GROQ_API_KEY?: string
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MAX_PROMPT_CHARS = 32_000
const MAX_MESSAGES = 40

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function validateMessages(messages: unknown): string | null {
  if (!Array.isArray(messages) || messages.length === 0) return 'messages must be a non-empty array'
  if (messages.length > MAX_MESSAGES) return `messages array exceeds limit of ${MAX_MESSAGES}`
  let totalChars = 0
  for (const m of messages) {
    if (typeof m !== 'object' || m === null) return 'each message must be an object'
    const msg = m as Record<string, unknown>
    if (!['system', 'user', 'assistant'].includes(msg.role as string)) {
      return `invalid role: ${String(msg.role)}`
    }
    if (typeof msg.content !== 'string') return 'message content must be a string'
    totalChars += msg.content.length
    if (totalChars > MAX_PROMPT_CHARS) {
      return `total prompt length exceeds ${MAX_PROMPT_CHARS} characters`
    }
  }
  return null
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context

  if (!env.GROQ_API_KEY) {
    return json(
      { error: { message: 'GROQ_API_KEY is not configured. Add it as an encrypted secret in Cloudflare Pages project settings.' } },
      500,
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: { message: 'Invalid JSON body' } }, 400)
  }

  if (!body || typeof body !== 'object') {
    return json({ error: { message: 'Request body must be a JSON object' } }, 400)
  }

  const validationError = validateMessages(body.messages)
  if (validationError) {
    return json({ error: { message: validationError } }, 400)
  }

  let groqRes: Response
  try {
    groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: body.model ?? 'llama-3.3-70b-versatile',
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 1024,
      }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network error'
    return json({ error: { message: `Failed to reach Groq: ${message}` } }, 502)
  }

  const data = await groqRes.json()
  return json(data, groqRes.status)
}
