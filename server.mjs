import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const examples = JSON.parse(await readFile(path.join(root, 'data/f1-radio-examples.json'), 'utf8'))
const PORT = Number(process.env.PORT || 8787)
const HF_MODEL = 'facebook/bart-large-mnli'

const driverLabels = ['rear slip', 'front grip loss', 'radio failure', 'rain report', 'race control', 'blue flag', 'pit request', 'other']
const engineerLabels = ['reduce curb', 'pit instruction', 'race control', 'blue flag', 'radio check', 'other']

function json(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' })
  response.end(JSON.stringify(payload))
}

function words(value) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2))
}

function similarity(left, right) {
  const a = words(left)
  const b = words(right)
  const overlap = [...a].filter((word) => b.has(word)).length
  return overlap / Math.max(1, Math.sqrt(a.size * b.size))
}

function bestExample(message, direction) {
  return examples.filter((example) => example.direction === direction).map((example) => ({ example, score: similarity(message, example.utterance) })).sort((a, b) => b.score - a.score)[0]
}

function turnFromMessage(message) {
  const match = message.match(/turn\s*(\d{1,2})/i)
  return match ? `T${match[1]}` : ''
}

function deterministicAnalysis(message, direction) {
  const text = message.toLowerCase()
  const turn = turnFromMessage(message)
  if (direction === 'driver_to_engineer') {
    if (/rear|slid|throttle|traction/.test(text)) return { state: 'FRUSTRATED', issue: 'REAR SLIP', keyword: `REAR SLIP${turn ? ` ${turn}` : ''}`, confidence: 0.92 }
    if (/front|tyre|tire|understeer/.test(text)) return { state: 'ELEVATED', issue: 'FRONT GRIP', keyword: `FRONT GRIP${turn ? ` ${turn}` : ''}`, confidence: 0.88 }
    if (/hear|radio|mic|microphone/.test(text)) return { state: 'URGENT', issue: 'RADIO FAILURE', keyword: 'RADIO FAIL', confidence: 0.96 }
    if (/safety car/.test(text)) return { state: 'FOCUSED', issue: 'RACE CONTROL', keyword: 'SAFETY CAR', confidence: 0.97 }
    if (/blue flag/.test(text)) return { state: 'FOCUSED', issue: 'BLUE FLAG', keyword: 'BLUE FLAG', confidence: 0.97 }
    if (/box|pit/.test(text)) return { state: 'FOCUSED', issue: 'PIT REQUEST', keyword: 'BOX', confidence: 0.94 }
  } else {
    if (/less curb/.test(text)) return { state: 'INSTRUCTION', issue: 'DRIVING LINE', keyword: `LESS CURB${turn ? ` ${turn}` : ''}`, confidence: 0.95 }
    if (/safety car/.test(text)) return { state: 'PRIORITY', issue: 'RACE CONTROL', keyword: 'SAFETY CAR', confidence: 0.97 }
    if (/blue flag/.test(text)) return { state: 'PRIORITY', issue: 'BLUE FLAG', keyword: 'BLUE FLAG', confidence: 0.97 }
    if (/box|pit/.test(text)) return { state: 'INSTRUCTION', issue: 'PIT INSTRUCTION', keyword: 'BOX THIS LAP', confidence: 0.94 }
  }
  return { state: 'REVIEW', issue: 'UNCLASSIFIED', keyword: 'REVIEW RADIO', confidence: 0.54 }
}

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

async function analyse(message, direction, team) {
  const match = bestExample(message, direction)
  const fallback = deterministicAnalysis(message, direction)
  const hfLabel = match?.score >= 0.28 ? null : await huggingFaceLabel(message, direction)
  const label = hfLabel || (match?.score >= 0.28 ? match.example.intent.replaceAll('_', ' ') : null)
  const result = { ...fallback, direction, team: team || null, original: message, matchedExample: match?.example?.utterance || null, retrievalScore: Number((match?.score || 0).toFixed(2)), provider: hfLabel ? `huggingface:${HF_MODEL}` : match?.score >= 0.28 ? 'hub-dataset-retrieval' : 'safe-local-fallback' }
  if (label && /rear slip/.test(label)) Object.assign(result, { issue: 'REAR SLIP', keyword: `REAR SLIP${turnFromMessage(message) ? ` ${turnFromMessage(message)}` : ''}` })
  if (label && /front grip/.test(label)) Object.assign(result, { issue: 'FRONT GRIP', keyword: `FRONT GRIP${turnFromMessage(message) ? ` ${turnFromMessage(message)}` : ''}` })
  return result
}

async function body(request) {
  let raw = ''
  for await (const chunk of request) raw += chunk
  return JSON.parse(raw || '{}')
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {})
  if (request.method === 'GET' && request.url === '/api/health') return json(response, 200, { ok: true, examples: examples.length, model: HF_MODEL })
  if (request.method === 'POST' && (request.url === '/api/analyse/driver' || request.url === '/api/analyse/engineer')) {
    try {
      const input = await body(request)
      if (!input.message || typeof input.message !== 'string') return json(response, 400, { error: 'message is required' })
      const direction = request.url.endsWith('/driver') ? 'driver_to_engineer' : 'engineer_to_driver'
      return json(response, 200, await analyse(input.message.trim(), direction, input.team))
    } catch (error) {
      return json(response, 400, { error: error.message || 'invalid request' })
    }
  }
  return json(response, 404, { error: 'not found' })
})

server.listen(PORT, () => console.log(`PitWall API listening on http://localhost:${PORT}`))
