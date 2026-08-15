import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { detectMoodFromText, detectMoodFromAudio } from './src/mood.mjs'
import { extractEngineerKeywords, primaryKeyword } from './src/keywords.mjs'
import { transcribeAudio } from './src/transcription.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const examples = JSON.parse(await readFile(path.join(root, 'data/hf-slice.json'), 'utf8'))
const PORT = Number(process.env.PORT || 8787)
const HF_MODEL = 'facebook/bart-large-mnli'

const driverLabels = ['rear slip', 'front grip loss', 'radio failure', 'rain report', 'race control', 'blue flag', 'pit request', 'other']
const engineerLabels = ['reduce curb', 'pit instruction', 'race control', 'blue flag', 'radio check', 'boost instruction', 'tyre management', 'other']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
  })
  response.end(JSON.stringify(payload))
}

function words(value) {
  return new Set(
    value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2),
  )
}

function similarity(left, right) {
  const a = words(left)
  const b = words(right)
  const overlap = [...a].filter((word) => b.has(word)).length
  return overlap / Math.max(1, Math.sqrt(a.size * b.size))
}

function bestExample(message, direction) {
  return examples
    .filter((example) => example.direction === direction)
    .map((example) => ({ example, score: similarity(message, example.utterance) }))
    .sort((a, b) => b.score - a.score)[0]
}

function turnFromMessage(message) {
  const match = message.match(/turn\s*(\d{1,2})/i)
  return match ? `T${match[1]}` : ''
}

function engineerReplyForMood(mood) {
  if (mood === 'ANGRY') return 'COPY. STAY WITH ME. REPORT THE CAR ISSUE.'
  if (mood === 'FRUSTRATED') return 'COPY. WE HEAR YOU. DESCRIBE THE ISSUE.'
  if (mood === 'URGENT') return 'UNDERSTOOD. RADIO PRIORITY. GO AHEAD.'
  return 'COPY. GO AHEAD.'
}

// ─── Deterministic driver analysis ────────────────────────────────────────────

function deterministicDriverAnalysis(message) {
  const text = message.toLowerCase()
  const turn = turnFromMessage(message)
  if (/rear|slid|throttle|traction/.test(text)) return { issue: 'REAR SLIP', keyword: `REAR SLIP${turn ? ` ${turn}` : ''}`, confidence: 0.92 }
  if (/front|tyre|tire|understeer/.test(text)) return { issue: 'FRONT GRIP', keyword: `FRONT GRIP${turn ? ` ${turn}` : ''}`, confidence: 0.88 }
  if (/hear|radio|mic|microphone/.test(text)) return { issue: 'RADIO FAILURE', keyword: 'RADIO FAIL', confidence: 0.96 }
  if (/safety car/.test(text)) return { issue: 'RACE CONTROL', keyword: 'SAFETY CAR', confidence: 0.97 }
  if (/blue flag/.test(text)) return { issue: 'BLUE FLAG', keyword: 'BLUE FLAG', confidence: 0.97 }
  if (/box|pit/.test(text)) return { issue: 'PIT REQUEST', keyword: 'BOX', confidence: 0.94 }
  if (/rain|wet|damp/.test(text)) return { issue: 'RAIN REPORT', keyword: `RAIN${turn ? ` ${turn}` : ''}`, confidence: 0.89 }
  return { issue: 'UNCLASSIFIED', keyword: 'REVIEW RADIO', confidence: 0.54 }
}

// ─── Hugging Face zero-shot classifier ────────────────────────────────────────

async function huggingFaceLabel(message, direction) {
  const token = process.env.HF_API_TOKEN
  if (!token) return null
  const labels = direction === 'driver_to_engineer' ? driverLabels : engineerLabels
  try {
    const response = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ inputs: message, parameters: { candidate_labels: labels, multi_label: false } }),
    })
    if (!response.ok) return null
    const result = await response.json()
    return result?.labels?.[0] || null
  } catch {
    return null
  }
}

// ─── Analyse: Driver → Engineer ───────────────────────────────────────────────

async function analyseDriver(message, team, audioFeatures) {
  const match = bestExample(message, 'driver_to_engineer')
  const fallback = deterministicDriverAnalysis(message)
  const hfLabel = match?.score >= 0.28 ? null : await huggingFaceLabel(message, 'driver_to_engineer')
  const label = hfLabel || (match?.score >= 0.28 ? match.example.intent?.replaceAll('_', ' ') : null)

  // Mood detection — use audio features if provided, else text-only
  const moodResult = audioFeatures
    ? detectMoodFromAudio(message, audioFeatures)
    : detectMoodFromText(message)

  const result = {
    state: moodResult.mood,
    mood: moodResult.mood,
    moodConfidence: moodResult.moodConfidence,
    moodReason: moodResult.moodReason,
    ...fallback,
    direction: 'driver_to_engineer',
    team: team || null,
    original: message,
    matchedExample: match?.example?.utterance || null,
    retrievalScore: Number((match?.score || 0).toFixed(2)),
    provider: hfLabel
      ? `huggingface:${HF_MODEL}`
      : match?.score >= 0.28
      ? 'hub-dataset-retrieval'
      : 'safe-local-fallback',
  }
  result.engineerReply = engineerReplyForMood(result.mood)

  // Override issue/keyword if HF/retrieval gave us a strong label
  if (label && /rear slip/.test(label)) {
    const turn = turnFromMessage(message)
    result.issue = 'REAR SLIP'
    result.keyword = `REAR SLIP${turn ? ` ${turn}` : ''}`
  }
  if (label && /front grip/.test(label)) {
    const turn = turnFromMessage(message)
    result.issue = 'FRONT GRIP'
    result.keyword = `FRONT GRIP${turn ? ` ${turn}` : ''}`
  }

  return result
}

// ─── Analyse: Engineer → Driver ───────────────────────────────────────────────

async function analyseEngineer(message, team) {
  const match = bestExample(message, 'engineer_to_driver')
  const hfLabel = match?.score >= 0.28 ? null : await huggingFaceLabel(message, 'engineer_to_driver')

  // Multi-keyword extraction is the primary feature here
  const keywords = extractEngineerKeywords(message)
  const keyword = keywords[0] || primaryKeyword(message)

  return {
    state: 'INSTRUCTION',
    keyword,
    keywords,          // full array for sequential display on steering wheel
    direction: 'engineer_to_driver',
    team: team || null,
    original: message,
    matchedExample: match?.example?.utterance || null,
    retrievalScore: Number((match?.score || 0).toFixed(2)),
    provider: hfLabel
      ? `huggingface:${HF_MODEL}`
      : match?.score >= 0.28
      ? 'hub-dataset-retrieval'
      : 'safe-local-fallback',
  }
}

// ─── HTTP body helpers ─────────────────────────────────────────────────────────

async function readJsonBody(request) {
  let raw = ''
  for await (const chunk of request) raw += chunk
  return JSON.parse(raw || '{}')
}

async function readRawBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return Buffer.concat(chunks)
}

// ─── Server ───────────────────────────────────────────────────────────────────

export async function handler(request, response) {
  if (request.method === 'OPTIONS') return json(response, 204, {})

  // GET /api/health
  if (request.method === 'GET' && request.url === '/api/health') {
    return json(response, 200, {
      ok: true,
      examples: examples.length,
      model: HF_MODEL,
      whisperModel: 'openai/whisper-large-v3',
      features: ['mood-detection', 'multi-keyword', 'voice-transcription'],
    })
  }

  // POST /api/analyse/driver
  if (request.method === 'POST' && request.url === '/api/analyse/driver') {
    try {
      const input = await readJsonBody(request)
      if (!input.message || typeof input.message !== 'string') {
        return json(response, 400, { error: 'message is required' })
      }
      // Optional audio features (rms, pitch) sent from browser audio analysis
      const audioFeatures = input.audioFeatures || null
      return json(response, 200, await analyseDriver(input.message.trim(), input.team, audioFeatures))
    } catch (error) {
      return json(response, 400, { error: error.message || 'invalid request' })
    }
  }

  // POST /api/analyse/engineer
  if (request.method === 'POST' && request.url === '/api/analyse/engineer') {
    try {
      const input = await readJsonBody(request)
      if (!input.message || typeof input.message !== 'string') {
        return json(response, 400, { error: 'message is required' })
      }
      return json(response, 200, await analyseEngineer(input.message.trim(), input.team))
    } catch (error) {
      return json(response, 400, { error: error.message || 'invalid request' })
    }
  }

  // POST /api/transcribe
  // Accepts raw audio blob (multipart or raw binary) and returns transcription + mood
  if (request.method === 'POST' && request.url?.startsWith('/api/transcribe')) {
    try {
      const contentType = request.headers['content-type'] || 'audio/webm'
      const audioBuffer = await readRawBody(request)

      if (!audioBuffer.length) {
        return json(response, 400, { error: 'audio data is required' })
      }

      // Try Whisper transcription
      let transcription
      try {
        transcription = await transcribeAudio(audioBuffer, contentType.split(';')[0].trim())
      } catch (err) {
        return json(response, 503, { error: `Transcription failed: ${err.message}` })
      }

      // Optionally run analysis on the transcribed text
      const direction = request.url.includes('engineer') ? 'engineer_to_driver' : 'driver_to_engineer'
      const team = new URL(request.url, 'http://localhost').searchParams.get('team') || null

      let analysis = {}
      if (direction === 'driver_to_engineer') {
        analysis = await analyseDriver(transcription.text, team, null)
      } else {
        analysis = await analyseEngineer(transcription.text, team)
      }

      return json(response, 200, {
        transcription: transcription.text,
        whisperModel: transcription.model,
        ...analysis,
      })
    } catch (error) {
      return json(response, 400, { error: error.message || 'transcription request failed' })
    }
  }

  return json(response, 404, { error: 'not found' })
}

// Vercel imports the default handler. Keep the local Node server for development.
export default handler

if (!process.env.VERCEL) {
  const server = http.createServer(handler)
  server.listen(PORT, () => console.log(`Pitwall API listening on http://localhost:${PORT}`))
}
