/**
 * Mood detection for F1 driver radio messages.
 *
 * Rules (text-only path, used when audio analysis is unavailable):
 *  - ANGRY     : cuss words detected AND high-intensity indicators
 *  - FRUSTRATED: cuss words detected OR strong frustration language, but calmer tone
 *  - CALM      : no cuss/frustration markers
 *
 * Rules (audio path, used when pitch RMS data is available):
 *  - ANGRY     : cuss words + high pitch energy (rms > 0.18)
 *  - FRUSTRATED: cuss words OR frustration language, moderate energy (rms 0.08-0.18)
 *  - CALM      : no markers OR low energy (rms < 0.08)
 */

const CUSS_WORDS = new Set([
  'shit', 'damn', 'crap', 'hell', 'ass', 'fuck', 'bloody', 'bastard',
  'idiot', 'stupid', 'useless', 'ridiculous', 'rubbish', 'bollocks',
  'crap', 'terrible', 'disaster', 'nightmare', 'impossible', 'pathetic',
])

const FRUSTRATION_PHRASES = [
  /can't (do|get|take|hold|make|manage)/i,
  /not working/i,
  /completely (lost|gone|off|wrong)/i,
  /no grip/i,
  /no traction/i,
  /sliding (everywhere|badly|all over)/i,
  /nothing (left|there)/i,
  /undriveable/i,
  /snapping/i,
  /bouncing/i,
  /losing (it|everything)/i,
]

const INTENSITY_PHRASES = [
  /what the/i,
  /are you (kidding|serious)/i,
  /this is (awful|terrible|a joke|unacceptable)/i,
  /come on/i,
  /for (god|christ|heaven)'?s sake/i,
  /absolutely (awful|terrible|ridiculous)/i,
]

/**
 * Count cuss words in a text string.
 * @param {string} text - lowercased input
 * @returns {number}
 */
function countCussWords(text) {
  const wordTokens = text.replace(/[^a-z\s]/g, ' ').split(/\s+/)
  return wordTokens.filter((w) => CUSS_WORDS.has(w)).length
}

/**
 * Detect mood purely from transcript text.
 * @param {string} text - the transcribed driver speech
 * @returns {{ mood: string, moodConfidence: number, moodReason: string }}
 */
export function detectMoodFromText(text) {
  const lower = text.toLowerCase()
  const cussCount = countCussWords(lower)
  const hasFrustration = FRUSTRATION_PHRASES.some((re) => re.test(lower))
  const hasIntensity = INTENSITY_PHRASES.some((re) => re.test(lower))

  if (cussCount >= 2 || (cussCount >= 1 && hasIntensity)) {
    return {
      mood: 'ANGRY',
      moodConfidence: Math.min(0.97, 0.72 + cussCount * 0.08),
      moodReason: 'strong language + intensity markers',
    }
  }

  if (cussCount === 1 || hasFrustration) {
    return {
      mood: 'FRUSTRATED',
      moodConfidence: Math.min(0.9, 0.62 + (cussCount * 0.1) + (hasFrustration ? 0.08 : 0)),
      moodReason: hasFrustration ? 'frustration language detected' : 'mild strong language',
    }
  }

  return {
    mood: 'CALM',
    moodConfidence: 0.78,
    moodReason: 'no stress indicators in text',
  }
}

/**
 * Detect mood combining text analysis with audio pitch/energy data.
 * @param {string} text - the transcribed driver speech
 * @param {{ rms: number, pitch?: number }} audioFeatures - extracted audio features
 * @returns {{ mood: string, moodConfidence: number, moodReason: string }}
 */
export function detectMoodFromAudio(text, audioFeatures) {
  const { rms = 0 } = audioFeatures
  const lower = text.toLowerCase()
  const cussCount = countCussWords(lower)
  const hasFrustration = FRUSTRATION_PHRASES.some((re) => re.test(lower))

  // High energy + cuss words = ANGRY
  if (rms > 0.18 && (cussCount >= 1 || hasFrustration)) {
    return {
      mood: 'ANGRY',
      moodConfidence: Math.min(0.97, 0.78 + rms * 0.6 + cussCount * 0.05),
      moodReason: `high vocal energy (${(rms * 100).toFixed(0)}%) + strong language`,
    }
  }

  // High energy alone = slightly frustrated/elevated
  if (rms > 0.18) {
    return {
      mood: 'FRUSTRATED',
      moodConfidence: 0.68,
      moodReason: `high vocal energy (${(rms * 100).toFixed(0)}%) detected`,
    }
  }

  // Moderate energy + text markers
  if (rms > 0.08 && (cussCount >= 1 || hasFrustration)) {
    return {
      mood: 'FRUSTRATED',
      moodConfidence: Math.min(0.88, 0.62 + rms + cussCount * 0.06),
      moodReason: `moderate energy (${(rms * 100).toFixed(0)}%) + frustration markers`,
    }
  }

  // Low energy = calm regardless of text
  if (rms <= 0.08) {
    return {
      mood: 'CALM',
      moodConfidence: Math.min(0.92, 0.72 + (0.08 - rms) * 2),
      moodReason: `low vocal energy (${(rms * 100).toFixed(0)}%)`,
    }
  }

  // Fallback to text-based
  return detectMoodFromText(text)
}
