import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, ChevronRight, CircleDot, Mic, Radio, Send, Sparkles as SparkleIcon, Square, Volume2 } from 'lucide-react'
import haasCar from './assets/haas-f1.jpeg'
import audiCar from './assets/audi-f1.jpg'
import mclarenCar from './assets/mclaren-mcl38.jpg'
import openingVideo from './assets/f1-opening-background.mp4'
import monacoLapRecord from './assets/MONACO LAP RECORD Lando Norris Pole Lap  2025 Monaco Grand Prix  Pirelli.mp4'
import radioSound from './assets/F1 Radio - Sound effect (HD).mp3'
import haasDriverOne from './assets/haas-driver-1.jpeg'
import haasDriverTwo from './assets/haas-driver-2.webp'
import audiDriverOne from './assets/Audi-Driver-1.jpeg'
import audiDriverTwo from './assets/Audi-Driver-2.jpeg'
import mclarenDriverOne from './assets/mclaren-driver- 1.jpg.webp'
import mclarenDriverTwo from './assets/mclaren-driver-2.jpg.webp'

const teams = [
  {
    id: 'haas',
    name: 'Haas', code: 'HAA', color: '#d71920', accent: '#f4f4f4', wheelBody: '#151518', wheelTrim: '#f4f4f4',
    image: haasCar,
    drivers: [
      { name: 'Esteban Ocon', number: '31', image: haasDriverOne, profile: 'PRECISE / FEEDBACK' },
      { name: 'Oliver Bearman', number: '87', image: haasDriverTwo, profile: 'DIRECT / HIGH TEMPO' },
    ],
    position: 'P7', points: '22', podiums: '0', races: '11',
    summary: 'A points-focused campaign where clear, concise feedback is essential for extracting the most from each race weekend.',
    signal: 'Prioritise fast issue classification and reliable driver acknowledgement during high-pressure calls.',
    audioIssues: [
      { event: 'ROUND 03 / BAHRAIN', label: 'SIGNAL LOSS', issue: 'Radio dropouts and missed acknowledgements during high-pressure calls.' },
      { event: 'ROUND 07 / IMOLA', label: 'LOW CLARITY', issue: 'Driver messages became difficult to hear over engine and pit-lane noise.' },
      { event: 'SEASON PATTERN', label: 'ACK NEEDED', issue: 'Shorter, confirmed instructions are needed when the race situation changes quickly.' },
    ],
  },
  {
    id: 'audi',
    name: 'Audi', code: 'AUD', color: '#e30613', accent: '#c9cdd1', wheelBody: '#17191c', wheelTrim: '#e7e7e7',
    image: audiCar,
    drivers: [
      { name: 'Gabriel Bortoleto', number: '5', image: audiDriverOne, profile: 'PRECISION / CONTROL' },
      { name: 'Nico Hulkenberg', number: '27', image: audiDriverTwo, profile: 'EXPERIENCE / FEEDBACK' },
    ],
    position: 'P8', points: '12', podiums: '0', races: '11',
    summary: 'The team is collecting points in its first season under the Audi name, with the focus on extracting reliable feedback and making every radio message actionable.',
    signal: 'Prioritise radio quality checks and precise issue reporting from the driver.',
    audioIssues: [
      { event: 'ROUND 02 / JEDDAH', label: 'RADIO CHECK', issue: 'Longer driver-to-pit acknowledgements created uncertainty during a strategy call.' },
      { event: 'ROUND 06 / MIAMI', label: 'PIT WALL DELAY', issue: 'Instruction changes needed a clearer repeat-back before the pit window closed.' },
      { event: 'SEASON PATTERN', label: 'CONFIRMATION', issue: 'Prioritise concise issue labels and explicit driver acknowledgement.' },
    ],
  },
  {
    id: 'mclaren',
    name: 'McLaren', code: 'MCL', color: '#ff8000', accent: '#8cebdd', wheelBody: '#17191b', wheelTrim: '#8cebdd',
    // Local footage keeps the cockpit background reliable in production.
    controllerVideo: monacoLapRecord,
    image: mclarenCar,
    drivers: [
      { name: 'Lando Norris', number: '4', image: mclarenDriverOne, profile: 'DIRECT / PRECISION' },
      { name: 'Oscar Piastri', number: '81', image: mclarenDriverTwo, profile: 'CALM / HIGH TEMPO' },
    ],
    position: 'P3', points: '220', podiums: '3', races: '11',
    summary: 'A recovery after an uneven opening stretch. The team benefits from concise strategy confirmation during high-pressure calls.',
    signal: 'Focus the radio desk on clear confirmation when strategy decisions change quickly.',
    audioIssues: [
      { event: 'ROUND 04 / SUZUKA', label: 'STRATEGY CHANGE', issue: 'Rapid strategy changes required shorter radio instructions and immediate confirmation.' },
      { event: 'ROUND 08 / MONACO', label: 'CROSS-TALK', issue: 'Multiple simultaneous calls made the key pit-wall instruction harder to isolate.' },
      { event: 'SEASON PATTERN', label: 'FAST REPLY', issue: 'Keep the engineer response brief, prioritised, and visible on the driver display.' },
    ],
  },
]

// ─── Mood helpers ──────────────────────────────────────────────────────────────

const MOOD_COLOUR = { ANGRY: '#ff4040', URGENT: '#ff4f5e', FRUSTRATED: '#ff9020', CALM: '#40d490', FOCUSED: '#40d490', REVIEW: '#f0b040' }
const MOOD_LABEL = { ANGRY: '⚠ ANGRY', URGENT: '‼ URGENT', FRUSTRATED: '! FRUSTRATED', CALM: '✓ CALM', FOCUSED: '✓ FOCUSED', REVIEW: '? UNCERTAIN' }

function moodColor(mood) {
  return MOOD_COLOUR[mood] || '#8da19a'
}

// ─── Voice recorder with browser SpeechRecognition ────────────────────────────
//
// Primary transcription: browser's built-in SpeechRecognition (Chrome/Edge).
// Works with zero API keys. Returns { transcript, audioFeatures: { rms } }.
// Web Audio API is used in parallel to compute RMS (vocal energy) for mood.

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition

function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)
  const rmsHistoryRef = useRef([])
  const streamRef = useRef(null)
  const pollIdRef = useRef(null)
  const transcriptRef = useRef('')
  const chunksRef = useRef([])
  const mediaRecorderRef = useRef(null)

  const start = useCallback(async () => {
    setError(null)
    transcriptRef.current = ''

    if (!SpeechRecognitionAPI) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser
      rmsHistoryRef.current = []

      const buffer = new Float32Array(analyser.fftSize)
      pollIdRef.current = setInterval(() => {
        if (!analyserRef.current) return
        analyser.getFloatTimeDomainData(buffer)
        const rms = Math.sqrt(buffer.reduce((sum, v) => sum + v * v, 0) / buffer.length)
        rmsHistoryRef.current.push(rms)
      }, 50)

      // Start MediaRecorder to capture blob for Whisper API
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(100)
      mediaRecorderRef.current = mr

      // Start local SpeechRecognition as a fallback
      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        let fullTranscript = ''
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript + ' '
        }
        transcriptRef.current = fullTranscript.trim()
      }

      recognition.onerror = (event) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          setError(`Speech error: ${event.error}`)
        }
      }

      recognition.start()
      recognitionRef.current = recognition
      setRecording(true)
    } catch (err) {
      setError(err.message || 'Microphone access denied')
    }
  }, [])

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      if (pollIdRef.current) { clearInterval(pollIdRef.current); pollIdRef.current = null }
      if (analyserRef.current) { analyserRef.current = null }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null }
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }

      const history = rmsHistoryRef.current
      const avgRms = history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0
      const audioFeatures = { rms: Number(avgRms.toFixed(4)) }

      // Wait for both recorders to finalize
      const p1 = new Promise((r) => {
        const mr = mediaRecorderRef.current
        if (!mr || mr.state === 'inactive') return r(null)
        mr.onstop = () => r(new Blob(chunksRef.current, { type: 'audio/webm' }))
        mr.stop()
      })

      const p2 = new Promise((r) => {
        const rec = recognitionRef.current
        if (!rec) return r('')
        rec.onend = () => r(transcriptRef.current.trim())
        try { rec.stop() } catch {}
      })

      Promise.all([p1, p2]).then(([blob, transcript]) => {
        setRecording(false)
        resolve({ transcript, blob, audioFeatures })
      })
    })
  }, [])

  return { recording, error, start, stop }
}


// ─── Shared UI ────────────────────────────────────────────────────────────────

function StepHeader({ step, onBack, title }) {
  return <header className="step-header">
    <button className="wordmark" onClick={onBack}><span><Radio size={16} /></span> PITWALL <em>COPILOT</em></button>
    {title ? <div className="desk-header-title">{title}</div> : <div className="step-track"><b className={step >= 1 ? 'done' : ''}>01 <small>WELCOME</small></b><i /><b className={step >= 2 ? 'done' : ''}>02 <small>TEAM</small></b><i /><b className={step >= 3 ? 'done' : ''}>03 <small>BRIEFING</small></b></div>}
    <div className="header-status"><CircleDot size={12} /> SEASON / 2026</div>
  </header>
}

function LiveRadioCard({ team, onOpen, signalMessage = '', mood = '', issue = '', reply = '', processing = false, confidence = null, timestamp = '' }) {
  const messages = useMemo(() => [
    team ? `${team.name} radio online. The channel is tuned to this team's terminology.` : 'Select a team to tune the radio channel to its terminology.',
    'Pitwall Copilot listens for signal loss, urgency and missed acknowledgement.',
  ], [team])
  const [messageIndex, setMessageIndex] = useState(0)
  const [typedMessage, setTypedMessage] = useState('')
  const confidenceNumber = confidence == null ? null : Number.parseFloat(String(confidence).replace('%', ''))
  const confidenceLabel = confidenceNumber == null || Number.isNaN(confidenceNumber) ? '—' : `${Math.round(confidenceNumber <= 1 ? confidenceNumber * 100 : confidenceNumber)}%`

  useEffect(() => {
    setTypedMessage('')
  }, [signalMessage])

  useEffect(() => {
    const activeMessage = signalMessage || messages[messageIndex]
    if (typedMessage.length < activeMessage.length) {
      const timer = window.setTimeout(() => setTypedMessage(activeMessage.slice(0, typedMessage.length + 1)), 23)
      return () => window.clearTimeout(timer)
    }
    if (signalMessage) return undefined
    const timer = window.setTimeout(() => {
      setTypedMessage('')
      setMessageIndex((current) => (current + 1) % messages.length)
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [messageIndex, messages, signalMessage, typedMessage])

  const openDesk = () => onOpen?.()
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDesk() }
  }

  return <aside className="live-radio-card" aria-label="Live team radio example" role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} onClick={openDesk} onKeyDown={handleKeyDown}>
    <div className="radio-card-top"><span>LIVE SIGNAL</span><i /><span>{team?.code || 'CH --'}</span></div>
    <div className="radio-team"><span className="radio-number">{team?.code || '01'}</span><div><strong>{team?.name || 'RADIO'}</strong><b>RADIO</b></div></div>
    <div className="mini-wave" aria-hidden="true">{Array.from({ length: 25 }).map((_, index) => <i key={index} style={{ '--h': `${7 + (index % 6) * 4}px`, '--delay': `${index * -.075}s` }} />)}</div>
    <p>{typedMessage}<span className="typing-cursor">|</span></p>
    <div className={`radio-progress ${processing ? 'is-processing' : ''}`} aria-label={processing ? 'Transcription and analysis in progress' : 'Signal processed'}><i /></div>
    {mood && <div className="radio-signal-meta"><strong style={{ color: moodColor(mood) }}>{MOOD_LABEL[mood] || mood}</strong>{issue && <span>{issue}</span>}</div>}
    {reply && <div className="radio-reply"><span>ENGINEER REPLY</span><b>{reply}</b></div>}
    <div className="radio-metrics"><span>AI CONFIDENCE <b>{confidenceLabel}</b></span><span>RECEIVED <b>{timestamp || '—'}</b></span></div>
    <div className="radio-card-footer"><span>COMMUNICATION EVENT</span><span>LISTENING</span></div>
  </aside>
}

// ─── F1 Wheel — hold-to-speak buttons ────────────────────────────────────────
// Left button = ENGINEER RADIO, Right button = DRIVER RADIO (swapped per spec)

function F1Wheel({ team, keywords, showKeywords, controlsEnabled = true, engineerRecording, driverRecording, onEngineerDown, onEngineerUp, onDriverDown, onDriverUp }) {
  const accent = team.color
  const secondary = team.accent
  const wheelBody = team.wheelBody || '#202c2d'
  const wheelTrim = team.wheelTrim || secondary

  const [kwIndex, setKwIndex] = useState(0)
  const [kwVisible, setKwVisible] = useState(false)

  useEffect(() => {
    if (!showKeywords || !keywords?.length) { setKwVisible(false); setKwIndex(0); return }
    setKwIndex(0)
    setKwVisible(true)
  }, [showKeywords, keywords])

  useEffect(() => {
    if (!kwVisible || !keywords?.length) return
    if (kwIndex >= keywords.length) { setKwVisible(false); return }
    const timer = setTimeout(() => setKwIndex((i) => i + 1), 3000)
    return () => clearTimeout(timer)
  }, [kwVisible, kwIndex, keywords])

  const currentKw = kwVisible && keywords?.[kwIndex] ? keywords[kwIndex] : null
  const mode = engineerRecording ? 'engineer' : driverRecording ? 'driver' : 'idle'

  // Live F1 telemetry dashboard state declared unconditionally at the top level
  const [telemetry, setTelemetry] = useState({
    speed: 284,
    gear: 7,
    diff: 0.042,
    ers: 82.4,
    wave: Array.from({ length: 30 }, () => 50)
  })

  useEffect(() => {
    // Speed updates every 120ms (fluctuates between 272 and 294)
    const speedInterval = setInterval(() => {
      setTelemetry(prev => {
        const delta = Math.floor(Math.random() * 5) - 2
        let nextSpeed = prev.speed + delta
        if (nextSpeed > 305) nextSpeed = 305
        if (nextSpeed < 265) nextSpeed = 265
        return { ...prev, speed: nextSpeed }
      })
    }, 120)

    // Gear changes occasionally (every 3s)
    const gearInterval = setInterval(() => {
      setTelemetry(prev => {
        const roll = Math.random()
        let nextGear = prev.gear
        if (roll < 0.15 && prev.gear > 5) nextGear = prev.gear - 1
        if (roll > 0.85 && prev.gear < 8) nextGear = prev.gear + 1
        return { ...prev, gear: nextGear }
      })
    }, 3000)

    // Delta/diff updates every 200ms
    const diffInterval = setInterval(() => {
      setTelemetry(prev => {
        const delta = (Math.random() * 0.016) - 0.008
        return { ...prev, diff: Number((prev.diff + delta).toFixed(3)) }
      })
    }, 200)

    // ERS slowly decreases (every 2s)
    const ersInterval = setInterval(() => {
      setTelemetry(prev => {
        let nextErs = prev.ers - 0.1
        if (nextErs < 20) nextErs = 95.0
        return { ...prev, ers: Number(nextErs.toFixed(1)) }
      })
    }, 2000)

    // Live wave updates every 90ms (going up and down continuously)
    const waveInterval = setInterval(() => {
      setTelemetry(prev => {
        const nextWave = [...prev.wave.slice(1)]
        const lastVal = prev.wave[prev.wave.length - 1]
        let nextVal = lastVal + (Math.random() * 16 - 8)
        if (nextVal > 90) nextVal = 75
        if (nextVal < 10) nextVal = 25
        nextWave.push(nextVal)
        return { ...prev, wave: nextWave }
      })
    }, 90)

    return () => {
      clearInterval(speedInterval)
      clearInterval(gearInterval)
      clearInterval(diffInterval)
      clearInterval(ersInterval)
      clearInterval(waveInterval)
    }
  }, [])

  // Render a hold-to-speak button as an SVG group
  const holdButton = (x, y, label, isRecording, onDown, onUp) => {
    const active = isRecording
    const disabled = !controlsEnabled
    const fill = active ? accent : '#10181a'
    const stroke = active ? accent : '#5d746f'
    const textFill = active ? '#06100e' : '#d7eee7'
    return (
      <g
        className={`wheel-hit ${active ? 'is-active wheel-mic-active' : ''} ${disabled ? 'is-disabled' : ''}`}
        role="button"
        tabIndex={disabled ? '-1' : '0'}
        aria-disabled={disabled}
        aria-label={disabled ? `${label} locked until wheel is engaged` : isRecording ? `Release to send ${label}` : `Hold ${label} to speak`}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        onMouseDown={() => !disabled && onDown()}
        onMouseUp={() => !disabled && onUp()}
        onMouseLeave={() => !disabled && onUp()}
        onTouchStart={(e) => { if (!disabled) { e.preventDefault(); onDown() } }}
        onTouchEnd={(e) => { if (!disabled) { e.preventDefault(); onUp() } }}
        onKeyDown={(e) => !disabled && e.key === ' ' && onDown()}
        onKeyUp={(e) => !disabled && e.key === ' ' && onUp()}
      >
        <rect x={x} y={y} width="112" height="42" rx="9" fill={fill} stroke={stroke} strokeWidth={active ? 3 : 2} />
        {active && <rect x={x} y={y} width="112" height="42" rx="9" fill="none" stroke={accent} strokeWidth="6" opacity=".3">
          <animate attributeName="opacity" values=".3;.8;.3" dur=".8s" repeatCount="indefinite" />
        </rect>}
        <text x={x + 56} y={y + 17} fill={textFill} textAnchor="middle" fontSize="10" fontFamily="DM Mono, monospace" letterSpacing="1">{label}</text>
        <text x={x + 56} y={y + 32} fill={active ? '#06100e' : '#8da19a'} textAnchor="middle" fontSize="8" fontFamily="DM Mono, monospace" letterSpacing="1">{active ? '● REC' : disabled ? 'LOCKED' : 'HOLD TO SPEAK'}</text>
      </g>
    )
  }

  return <svg className="vector-wheel" viewBox="0 0 1000 690" role="img" aria-label={`${team.name} F1 steering wheel — hold a button to speak`}>
    <defs>
      <linearGradient id="wheelBody" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={wheelBody} /><stop offset=".32" stopColor={accent} stopOpacity=".32" /><stop offset=".56" stopColor="#080b0d" /><stop offset="1" stopColor={secondary} stopOpacity=".28" /></linearGradient>
      <linearGradient id="screenGlow" x1="0" x2="1"><stop stopColor={accent} stopOpacity=".9" /><stop offset="1" stopColor={secondary} stopOpacity=".8" /></linearGradient>
      <filter id="wheelShadow"><feDropShadow dx="0" dy="22" stdDeviation="18" floodColor="#000" floodOpacity=".55" /></filter>
    </defs>
    <ellipse cx="500" cy="625" rx="350" ry="24" fill={accent} opacity=".13" />
    <g filter="url(#wheelShadow)">
      <path d="M118 187 C142 109 238 68 327 110 L394 150 L606 150 L673 110 C762 68 858 109 882 187 L821 231 L792 436 C780 523 704 568 622 539 L554 507 L446 507 L378 539 C296 568 220 523 208 436 L179 231 Z" fill="url(#wheelBody)" stroke={wheelTrim} strokeOpacity=".72" strokeWidth="5" />
      <path d="M166 207 C193 135 255 112 318 139 L383 176 L617 176 L682 139 C745 112 807 135 834 207 L792 224 L764 405 C753 476 691 506 631 486 L558 457 L442 457 L369 486 C309 506 247 476 236 405 L208 224 Z" fill="#0d1517" stroke={accent} strokeOpacity=".3" strokeWidth="3" />
      <path d="M176 196 C124 198 93 247 100 326 C106 400 135 463 177 493 L222 459 L207 252 Z" fill={wheelBody} stroke={wheelTrim} strokeOpacity=".6" strokeWidth="5" />
      <path d="M824 196 C876 198 907 247 900 326 C894 400 865 463 823 493 L778 459 L793 252 Z" fill={wheelBody} stroke={wheelTrim} strokeOpacity=".6" strokeWidth="5" />
      <path d="M390 194 L610 194 L655 232 L655 402 L610 438 L390 438 L345 402 L345 232 Z" fill="#091012" stroke={wheelTrim} strokeOpacity=".7" strokeWidth="4" />

      {/* Center screen */}
      <rect x="371" y="220" width="258" height="145" rx="10" fill={currentKw ? '#ffffff' : '#081012'} stroke={currentKw ? '#ffffff' : accent} strokeOpacity={currentKw ? '1' : '.65'} strokeWidth="3" style={{ transition: 'fill .3s, stroke .3s' }} />
      <rect x="389" y="239" width="222" height="10" rx="5" fill={currentKw ? '#cccccc' : 'url(#screenGlow)'} opacity=".78" style={{ transition: 'fill .3s' }} />

      {currentKw ? (() => {
        const words = currentKw.split(' ')
        if (words.length === 3) {
          return (
            <>
              <text x="500" y="280" fill="#07110e" textAnchor="middle" fontSize="24" fontWeight="700" fontFamily="Space Grotesk, sans-serif" letterSpacing="-1" className="wheel-kw-text">{words[0]} {words[1]}</text>
              <text x="500" y="304" fill="#07110e" textAnchor="middle" fontSize="24" fontWeight="700" fontFamily="Space Grotesk, sans-serif" letterSpacing="-1" className="wheel-kw-text">{words[2]}</text>
              <text x="500" y="328" fill="#4d5a56" textAnchor="middle" fontSize="9" fontFamily="DM Mono, monospace" letterSpacing="2">ENGINEER MESSAGE</text>
              {keywords.length > 1 && <text x="500" y="348" fill="#888" textAnchor="middle" fontSize="8" fontFamily="DM Mono, monospace">{kwIndex + 1} / {keywords.length}</text>}
            </>
          )
        }
        return (
          <>
            <text x="500" y="295" fill="#07110e" textAnchor="middle" fontSize="26" fontWeight="700" fontFamily="Space Grotesk, sans-serif" letterSpacing="-1" className="wheel-kw-text">{currentKw}</text>
            <text x="500" y="318" fill="#4d5a56" textAnchor="middle" fontSize="9" fontFamily="DM Mono, monospace" letterSpacing="2">ENGINEER MESSAGE</text>
            {keywords.length > 1 && <text x="500" y="348" fill="#888" textAnchor="middle" fontSize="8" fontFamily="DM Mono, monospace">{kwIndex + 1} / {keywords.length}</text>}
          </>
        )
      })() : engineerRecording ? (
        <>
          <text x="500" y="291" fill={accent} textAnchor="middle" fontSize="13" fontFamily="DM Mono, monospace" letterSpacing="1">ENGINEER SPEAKING</text>
          <text x="500" y="312" fill="#8da19a" textAnchor="middle" fontSize="10" fontFamily="DM Mono, monospace">LISTENING…</text>
        </>
      ) : driverRecording ? (
        <>
          <text x="500" y="291" fill={accent} textAnchor="middle" fontSize="13" fontFamily="DM Mono, monospace" letterSpacing="1">DRIVER SPEAKING</text>
          <text x="500" y="312" fill="#8da19a" textAnchor="middle" fontSize="10" fontFamily="DM Mono, monospace">LISTENING…</text>
        </>
      ) : (() => {
        const wavePath = telemetry.wave.map((val, i) => {
          const wx = 389 + i * (222 / (telemetry.wave.length - 1))
          const wy = 352 + (val - 50) * 0.16
          return `${i === 0 ? 'M' : 'L'} ${wx} ${wy}`
        }).join(' ')

        return (
          <>
            {/* Speed & Lap */}
            <text x="389" y="268" fill="#8da19a" fontSize="8" fontFamily="DM Mono, monospace">SPD</text>
            <text x="389" y="290" fill="#ffffff" fontSize="18" fontWeight="700" fontFamily="DM Mono, monospace">{telemetry.speed}</text>
            <text x="389" y="306" fill="#8da19a" fontSize="7" fontFamily="DM Mono, monospace">KM/H</text>
            
            <text x="389" y="325" fill="#8da19a" fontSize="8" fontFamily="DM Mono, monospace">LAP</text>
            <text x="389" y="340" fill="#ffffff" fontSize="11" fontFamily="DM Mono, monospace">42/78</text>

            {/* Gear Indicator Box */}
            <rect x="474" y="258" width="52" height="58" rx="6" fill="#111b1c" stroke="#394b4b" strokeWidth="1.5" />
            <text x="500" y="301" fill={accent} fontSize="34" fontWeight="800" fontFamily="Space Grotesk, sans-serif" textAnchor="middle">{telemetry.gear}</text>
            <text x="500" y="328" fill="#8da19a" fontSize="8" fontFamily="DM Mono, monospace" textAnchor="middle">GEAR</text>

            {/* Diff & ERS */}
            <text x="611" y="268" fill="#8da19a" fontSize="8" fontFamily="DM Mono, monospace" textAnchor="end">DIFF</text>
            <text x="611" y="290" fill={telemetry.diff >= 0 ? '#ff5252' : '#4dff4d'} fontSize="14" fontWeight="700" fontFamily="DM Mono, monospace" textAnchor="end">
              {(telemetry.diff >= 0 ? '+' : '') + telemetry.diff.toFixed(3)}
            </text>
            
            <text x="611" y="325" fill="#8da19a" fontSize="8" fontFamily="DM Mono, monospace" textAnchor="end">ERS</text>
            <text x="611" y="340" fill="#ffffff" fontSize="11" fontFamily="DM Mono, monospace" textAnchor="end">{telemetry.ers}%</text>

            {/* Telemetry wave path (Image1) */}
            <path d={wavePath} fill="none" stroke="#5d746f" strokeWidth="1.5" opacity="0.75" />
          </>
        )
      })()}

      {Array.from({ length: 15 }).map((_, index) => <rect key={index} x={389 + index * 14.4} y="256" width="8" height={8 + (index % 4) * 4} rx="3" fill={index % 4 === 0 ? secondary : accent} opacity=".75" />)}
      {Array.from({ length: 12 }).map((_, index) => <circle key={`led-${index}`} cx={401 + index * 18} cy="187" r="5" fill={index < 4 ? accent : index < 8 ? secondary : '#77d8ba'} opacity=".85" />)}
      <circle cx="271" cy="255" r="48" fill="#121d1e" stroke={accent} strokeWidth="4" /><text x="271" y="261" textAnchor="middle" fill={accent} fontSize="22" fontFamily="DM Mono">BRK</text>
      <circle cx="729" cy="255" r="48" fill="#121d1e" stroke={secondary} strokeWidth="4" /><text x="729" y="261" textAnchor="middle" fill={secondary} fontSize="22" fontFamily="DM Mono">THR</text>
      <circle cx="278" cy="379" r="42" fill="#151f20" stroke="#d85d5a" strokeWidth="5" /><text x="278" y="386" textAnchor="middle" fill="#f4aca0" fontSize="17" fontFamily="DM Mono">DIFF</text>
      <circle cx="722" cy="379" r="42" fill="#151f20" stroke="#5fc6aa" strokeWidth="5" /><text x="722" y="386" textAnchor="middle" fill="#a9f5df" fontSize="17" fontFamily="DM Mono">GRP</text>
      <circle cx="500" cy="414" r="27" fill="#111b1c" stroke="#83a79b" strokeWidth="3" /><text x="500" y="420" textAnchor="middle" fill="#dcfff4" fontSize="15" fontFamily="DM Mono">N</text>

      {/* LEFT = ENGINEER RADIO, RIGHT = DRIVER RADIO (swapped per spec) */}
      {holdButton(128, 139, 'ENGINEER RADIO', engineerRecording, onEngineerDown, onEngineerUp)}
      {holdButton(760, 139, 'DRIVER RADIO', driverRecording, onDriverDown, onDriverUp)}

      <text x="184" y="530" fill="#7d9990" fontSize="11" fontFamily="DM Mono" letterSpacing="2">ENGINEER</text>
      <text x="741" y="530" fill="#7d9990" fontSize="11" fontFamily="DM Mono" letterSpacing="2">DRIVER</text>
    </g>
  </svg>
}

// ─── Cockpit Link — main interactive page ────────────────────────────────────
// Engineer button (left) and Driver button (right) are hold-to-speak mics.
// Left panel shows engineer transcript, right shows driver transcript + mood.

function CockpitLink({ team, onBack, onStart, onDriverSpeak }) {
  const sequenceRef = useRef()
  const [progress, setProgress] = useState(0)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })

  // Voice recorder instances
  const engineerRecorder = useVoiceRecorder()
  const driverRecorder = useVoiceRecorder()

  // Transcript panels
  const [engineerTranscript, setEngineerTranscript] = useState('')
  const [engineerProcessing, setEngineerProcessing] = useState(false)
  const [driverTranscript, setDriverTranscript] = useState('')
  const [driverMood, setDriverMood] = useState(null)
  const [driverIssue, setDriverIssue] = useState('')
  const [driverReply, setDriverReply] = useState('')
  const [driverConfidence, setDriverConfidence] = useState(null)
  const [driverTimestamp, setDriverTimestamp] = useState('')
  const [driverProcessing, setDriverProcessing] = useState(false)

  // Wheel keyword display
  const [wheelKeywords, setWheelKeywords] = useState([])
  const [showWheelKeywords, setShowWheelKeywords] = useState(false)

  useEffect(() => {
    const updateProgress = () => {
      const section = sequenceRef.current
      if (!section) return
      const rect = section.getBoundingClientRect()
      const distance = section.offsetHeight - window.innerHeight
      setProgress(Math.min(1, Math.max(0, -rect.top / distance)))
    }
    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)
    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [])

  // ── Engineer hold-to-speak ──
  const handleEngineerDown = useCallback(async () => {
    if (progress < 0.72 || engineerRecorder.recording || driverRecorder.recording) return
    await engineerRecorder.start()
  }, [engineerRecorder, driverRecorder, progress])

  const handleEngineerUp = useCallback(async () => {
    if (!engineerRecorder.recording) return
    setEngineerProcessing(true)
    const result = await engineerRecorder.stop()
    if (!result) { setEngineerProcessing(false); return }

    const { transcript, blob } = result
    let text = transcript?.trim()
    
    // Try to get the high-accuracy transcript from Whisper first
    try {
      if (blob) {
        const whisperRes = await requestTranscription(blob, 'engineer', team)
        if (whisperRes.transcription) text = whisperRes.transcription
      }
    } catch {}

    if (text) setEngineerTranscript(text)

    try {
      // Send text to backend for keyword extraction
      const res = await requestRadioAnalysis('/api/analyse/engineer', text || engineerTranscript || '', team, null)
      let kws = res.keywords?.length > 0 ? res.keywords : res.keyword ? [res.keyword] : []
      
      // If backend returned the default fallback, try smart extraction
      if (kws.length === 0 || (kws.length === 1 && kws[0] === 'CHECK RADIO')) {
        const smart = smartExtractKeywords(text || '')
        if (smart.length > 0) kws = smart
      }

      setWheelKeywords(kws)
      setShowWheelKeywords(false)
      setTimeout(() => setShowWheelKeywords(true), 60)
      setTimeout(() => setShowWheelKeywords(false), kws.length * 3000 + 300)
    } catch {
      // Local fallback using the real transcript
      let kws = extractEngineerKeywordsLocal(text || engineerTranscript || '')
      if (kws.length === 0 || (kws.length === 1 && kws[0] === 'CHECK RADIO')) {
        const smart = smartExtractKeywords(text || engineerTranscript || '')
        if (smart.length > 0) kws = smart
      }
      if (kws.length === 0) kws = ['CHECK RADIO']

      setWheelKeywords(kws)
      setShowWheelKeywords(false)
      setTimeout(() => setShowWheelKeywords(true), 60)
      setTimeout(() => setShowWheelKeywords(false), kws.length * 3000 + 300)
    } finally {
      setEngineerProcessing(false)
    }
  }, [engineerRecorder, driverRecorder, team, engineerTranscript])

  // ── Driver hold-to-speak ──
  const handleDriverDown = useCallback(async () => {
    if (progress < 0.72 || driverRecorder.recording || engineerRecorder.recording) return
    onDriverSpeak?.()
    setDriverTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    setDriverConfidence(null)
    setDriverReply('')
    await driverRecorder.start()
  }, [driverRecorder, engineerRecorder, onDriverSpeak, progress])

  const handleDriverUp = useCallback(async () => {
    if (!driverRecorder.recording) return
    setDriverProcessing(true)
    const result = await driverRecorder.stop()
    if (!result) { setDriverProcessing(false); return }

    const { transcript, audioFeatures, blob } = result
    let text = transcript?.trim()
    
    // Try to get the high-accuracy transcript from Whisper first
    try {
      if (blob) {
        const whisperRes = await requestTranscription(blob, 'driver', team)
        if (whisperRes.transcription) text = whisperRes.transcription
      }
    } catch {}

    if (text) setDriverTranscript(text)

    // Determine mood from BOTH text cuss-words AND audio RMS energy
    // RMS > 0.18 = high vocal energy (ANGRY), > 0.08 = medium (FRUSTRATED)
    let rmsBasedMood = 'CALM'
    if (audioFeatures.rms > 0.18) rmsBasedMood = 'ANGRY'
    else if (audioFeatures.rms > 0.08) rmsBasedMood = 'FRUSTRATED'

    // Explicitly check for cuss words or asterisks (censored profanity)
    const CUSS = ['shit', 'damn', 'crap', 'hell', 'fuck', 'bloody', 'bastard', 'rubbish', 'ridiculous', 'useless', 'idiot', 'stupid', 'terrible', 'horrible', 'awful', 'pathetic', 'garbage', 'trash', 'dammit', 'bollocks', 'screw', 'sucks', 'hate', 'worst', 'disaster', 'unbelievable', 'insane']
    const censoredCount = (text?.match(/\*{3,}/g) || []).length
    const cussCount = CUSS.filter(w => text?.toLowerCase().includes(w)).length + censoredCount

    try {
      // Send transcript + audio features to backend for classification
      const res = await requestRadioAnalysis('/api/analyse/driver', text || driverTranscript || '', team, audioFeatures)
      let textMood = res.mood || res.state || 'CALM'
      
      // Force text mood to ANGRY if explicit profanity is found, overriding backend
      if (cussCount >= 1) textMood = 'ANGRY'

      // Take the more extreme of the two mood signals
      const moodRank = { CALM: 0, FOCUSED: 0, REVIEW: 1, FRUSTRATED: 2, URGENT: 3, ANGRY: 4 }
      const finalMood = (moodRank[rmsBasedMood] || 0) >= (moodRank[textMood] || 0) ? rmsBasedMood : textMood

      setDriverMood(finalMood)
      setDriverIssue(res.issue || res.keyword || '')
      setDriverConfidence(res.moodConfidence ?? res.confidence ?? null)
      setDriverReply(res.engineerReply || '')
    } catch {
      // Local fallback: combine text analysis + rms
      const local = analyseDriverMessage(text || driverTranscript || '')
      const moodRank = { CALM: 0, FOCUSED: 0, REVIEW: 1, FRUSTRATED: 2, URGENT: 3, ANGRY: 4 }
      const localMoodStr = local.state || 'CALM'
      const finalMood = (moodRank[rmsBasedMood] || 0) >= (moodRank[localMoodStr] || 0) ? rmsBasedMood : localMoodStr
      setDriverMood(finalMood)
      setDriverIssue(local.issue || '')
      setDriverConfidence(local.confidence ?? null)
      setDriverReply(local.state === 'ANGRY' ? 'COPY. STAY WITH ME. REPORT THE CAR ISSUE.' : local.state === 'URGENT' ? 'UNDERSTOOD. RADIO PRIORITY. GO AHEAD.' : local.state === 'FRUSTRATED' ? 'COPY. WE HEAR YOU. DESCRIBE THE ISSUE.' : 'COPY. GO AHEAD.')
    } finally {
      setDriverProcessing(false)
    }
  }, [driverRecorder, engineerRecorder, team, driverTranscript])

  const panelOpacity = Math.max(0, Math.min(1, (progress - .72) * 3.6))
  const controlsEnabled = progress >= 0.72
  const introOpacity = Math.max(0, 1 - progress * 2.5)
  const wheelStyle = {
    transform: `translate(calc(-50% + ${pointer.x * 12}px), calc(-50% + ${progress * 95 + pointer.y * 6}px)) scale(${1.02 - progress * .14}) rotate(${progress * 1.2 + pointer.x * 1.1}deg)`,
  }
  const moveWheel = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setPointer({ x: (event.clientX - rect.left) / rect.width * 2 - 1, y: (event.clientY - rect.top) / rect.height * 2 - 1 })
  }

  return <section className="cockpit-sequence" ref={sequenceRef}>
    <div className="cockpit-sticky" onPointerMove={moveWheel} onPointerLeave={() => setPointer({ x: 0, y: 0 })}>
      {team.controllerVideo && (
        <>
          <video className="cockpit-background-video" src={team.controllerVideo} autoPlay muted loop playsInline preload="auto" aria-hidden="true" />
          <div className="cockpit-background-shade" aria-hidden="true" />
        </>
      )}
      <StepHeader step={3} title={`${team.name.toUpperCase()} / COCKPIT LINK`} onBack={onBack} />
      <div className="cockpit-topline"><span><i /> TEAM PROFILE LOCKED</span><span>SCROLL TO ENGAGE</span></div>

      {/* Intro copy fades out as wheel locks */}
      <div className="sequence-copy" style={{ opacity: introOpacity, transform: `translateY(${-progress * 65}px)` }}>
        <div className="soft-label"><span /> PITWALL INTERFACE</div>
        <h1>Your wheel is<br /><em>the signal.</em></h1>
        <p>Hold <strong>ENGINEER RADIO</strong> or <strong>DRIVER RADIO</strong> on the wheel to speak. The AI will transcribe, classify, and relay your message.</p>
      </div>

      {/* Steering wheel */}
      <div className="sequence-wheel" style={wheelStyle}>
        <F1Wheel
          team={team}
          keywords={wheelKeywords}
          showKeywords={showWheelKeywords}
          controlsEnabled={controlsEnabled}
          engineerRecording={engineerRecorder.recording}
          driverRecording={driverRecorder.recording}
          onEngineerDown={handleEngineerDown}
          onEngineerUp={handleEngineerUp}
          onDriverDown={handleDriverDown}
          onDriverUp={handleDriverUp}
        />
      </div>

      {/* Hood decoration */}
      <div className="cockpit-hood" style={{ opacity: Math.min(1, progress * 1.7) }}><span className="hood-light hood-left" /><span className="hood-light hood-right" /><b>COCKPIT LINK</b></div>

      {/* Persistent blue live-signal panel. It becomes readable once the wheel locks. */}
      <div className="sequence-radio" style={{ opacity: panelOpacity, pointerEvents: panelOpacity > .5 ? 'auto' : 'none', transform: `translateX(${(1 - panelOpacity) * 36}px)` }}>
        <LiveRadioCard team={team} onOpen={() => onStart?.()} signalMessage={driverProcessing ? 'TRANSCRIBING / ANALYSING…' : driverTranscript ? `DRIVER: ${driverTranscript}` : ''} mood={driverMood} issue={driverIssue} reply={driverReply} processing={driverProcessing} confidence={driverConfidence} timestamp={driverTimestamp} />
      </div>

      {/* Engineer transcript panel — LEFT side */}
      <div className="cockpit-transcript cockpit-transcript-left" style={{ opacity: panelOpacity, pointerEvents: panelOpacity > .5 ? 'auto' : 'none', transform: `translateX(${(1 - panelOpacity) * -28}px)` }}>
        <div className="ct-label"><span className="ct-dot" /> ENGINEER RADIO</div>
        {engineerProcessing
          ? <p className="ct-processing">PROCESSING…</p>
          : engineerTranscript
          ? <p className="ct-text">"{engineerTranscript}"</p>
          : <p className="ct-idle">Hold ENGINEER RADIO to speak.</p>}
        {wheelKeywords.length > 0 && !engineerProcessing && (
          <div className="ct-keywords">
            {wheelKeywords.map((kw, i) => <span key={i} className="ct-kw">{kw}</span>)}
          </div>
        )}
      </div>

      <div className="scroll-marker" style={{ opacity: introOpacity }}>SCROLL <span>↓</span></div>
    </div>
  </section>
}


// ─── Sample messages ──────────────────────────────────────────────────────────

const driverSamples = ['The rear is sliding badly through Turn 2.', 'The front tyres are gone.', "I can't hear you properly.", 'Box this lap.', 'Safety car, safety car.']
const engineerSamples = ['Take less curb at Turn 2.', 'Box this lap.', 'Safety car deployed.', 'Blue flag.', 'Take less curb at Turn 4 and use boost on the exit.']

// ─── Local fallback helpers ───────────────────────────────────────────────────

/**
 * Extract the top 2–3 most meaningful words from raw speech,
 * stripping stop-words. Used when no pattern matches.
 */
const STOP_WORDS = new Set([
  'a','an','the','i','we','you','they','he','she','it','my','your','our','their','its',
  'is','am','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','must','shall','can',
  'and','but','or','so','yet','for','nor','on','in','at','by','to','of','up',
  'this','that','these','those','what','just','ok','okay','um','uh','like','yeah','yep','no','yes',
  'with','about','from','into','then','than','also','very','quite',
])

function smartExtractKeywords(transcript) {
  if (!transcript?.trim()) return ['CHECK RADIO']
  const words = transcript
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 1 && !STOP_WORDS.has(w.toLowerCase()))
  const unique = [...new Set(words)]
  if (unique.length === 0) return ['CHECK RADIO']
  
  // If 3 words or fewer, keep them all on one screen
  if (unique.length <= 3) {
    return [unique.join(' ')]
  }
  // If exactly 4 words, split evenly into two screens of 2 words
  if (unique.length === 4) {
    return [unique.slice(0, 2).join(' '), unique.slice(2, 4).join(' ')]
  }
  
  // For 5+ words, chunk into groups of 3
  const labels = []
  for (let i = 0; i < unique.length; i += 3) {
    labels.push(unique.slice(i, i + 3).join(' '))
  }
  return labels.slice(0, 3) // Max 3 screens to keep it brief
}

function extractTurn(message) {
  // Handle spelled out numbers and common mishearings (like "to" -> 2)
  const map = {
    one: '1', two: '2', to: '2', too: '2',
    three: '3', tree: '3', four: '4', for: '4',
    five: '5', six: '6', seven: '7', eight: '8', ate: '8',
    nine: '9', ten: '10', eleven: '11', twelve: '12'
  }
  const match = message.match(/turn\s*(\d{1,2}|one|two|to|too|three|tree|four|for|five|six|seven|eight|ate|nine|ten|eleven|twelve)/i)
  if (!match) return ''
  let val = match[1].toLowerCase()
  return `T${map[val] || val}`
}

function analyseDriverMessage(message) {
  const text = message.toLowerCase()
  const turn = extractTurn(message)

  // Extended cuss/frustration word list covering common speech
  const CUSS = [
    'shit', 'damn', 'crap', 'hell', 'fuck', 'bloody', 'bastard', 'rubbish',
    'ridiculous', 'useless', 'idiot', 'stupid', 'terrible', 'horrible',
    'awful', 'pathetic', 'garbage', 'trash', 'dammit', 'bollocks', 'crap',
    'screw', 'sucks', 'hate', 'worst', 'disaster', 'unbelievable', 'insane',
  ]
  
  // Browser SpeechRecognition automatically censors profanity with asterisks (e.g., ****)
  const censoredCount = (message.match(/\*{3,}/g) || []).length
  const rawCussCount = CUSS.filter((w) => text.includes(w)).length
  const cussCount = rawCussCount + censoredCount

  // Frustration phrases (negative statements even without cuss words)
  const frustrated = /can't|cannot|won't|not working|no grip|no traction|losing|sliding|oversteering|understeering|too (slow|fast|wide|tight)|going (wide|off|off-track)|missing|struggling|problem|issue|wrong|bad|worse|losing it/i.test(text)

  let state = 'CALM'
  if (/\bhelp\b|emergency|urgent|respond|can't hear|radio (failure|broken|down)/i.test(text)) state = 'URGENT'
  else if (cussCount >= 2) state = 'ANGRY'
  else if (cussCount >= 1) state = 'ANGRY'
  else if (frustrated) state = 'FRUSTRATED'
  else if (/rear|slid|throttle|traction|snap/.test(text)) state = 'FRUSTRATED'

  if (/rear|slid|throttle|traction|snap|oversteer/.test(text)) return { state, issue: 'REAR SLIP', keyword: `REAR SLIP${turn ? ` ${turn}` : ''}`, confidence: '92%' }
  if (/front|tyre|tire|understeer|grip/.test(text)) return { state, issue: 'FRONT GRIP', keyword: `FRONT GRIP${turn ? ` ${turn}` : ''}`, confidence: '88%' }
  if (/hear|radio|mic|microphone|signal|static/.test(text)) return { state: 'URGENT', issue: 'RADIO FAILURE', keyword: 'RADIO FAIL', confidence: '96%' }
  if (/safety car|vsc|yellow/.test(text)) return { state: 'FOCUSED', issue: 'RACE CONTROL', keyword: 'SAFETY CAR', confidence: '97%' }
  if (/box|pit|stop|come in/.test(text)) return { state: 'FOCUSED', issue: 'PIT REQUEST', keyword: 'BOX', confidence: '94%' }
  if (/brake|braking|lock/.test(text)) return { state, issue: 'BRAKING', keyword: `BRAKES${turn ? ` ${turn}` : ''}`, confidence: '85%' }
  if (/engine|power|deploy|ers|mgu|motor/.test(text)) return { state, issue: 'POWER UNIT', keyword: 'ENGINE ISSUE', confidence: '83%' }
  // If cuss words detected but no specific issue, it's an ANGRY/FRUSTRATED unclassified
  if (cussCount >= 1) return { state, issue: 'GENERAL COMPLAINT', keyword: 'DRIVER UNHAPPY', confidence: '70%' }
  return { state, issue: 'UNCLASSIFIED', keyword: 'REVIEW RADIO', confidence: '54%' }
}

function extractEngineerKeywordsLocal(message) {
  if (!message || !message.trim()) return []
  const text = message.toLowerCase()
  const turn = extractTurn(message)
  const keywords = []
  // Curb/apex/line instructions
  if (/less curb|less kerb|cut the apex|apex/.test(text)) keywords.push(`LESS CURB${turn ? ` ${turn}` : ''}`)
  if (/more curb|more kerb|use the curb/.test(text)) keywords.push(`USE CURB${turn ? ` ${turn}` : ''}`)
  // Throttle / deployment
  if (/\bboost\b|deploy|throttle up|full power|kers/.test(text)) keywords.push(`BOOST EXIT${turn ? ` ${turn}` : ''}`)
  if (/lift and coast|lift and\s|save fuel|manage fuel/.test(text)) keywords.push('SAVE FUEL')
  // Racing line
  if (/wide|run wide|go wide/.test(text)) keywords.push(`WIDE${turn ? ` ${turn}` : ''}`)
  if (/\btight\b|inside|inside line/.test(text)) keywords.push(`TIGHT${turn ? ` ${turn}` : ''}`)
  // Push / hold
  if (/push hard|push now|attack|go go go/.test(text)) keywords.push('PUSH NOW')
  if (/hold position|stay behind|stay out/.test(text)) keywords.push('HOLD POSITION')
  if (/delta|hold pace|maintain|manage gap/.test(text)) keywords.push('HOLD DELTA')
  // Strategy
  if (/plan\s+([a-z])/i.test(text)) {
    keywords.push(`PLAN ${text.match(/plan\s+([a-z])/i)[1].toUpperCase()}`)
  }
  // Tyres
  if (/manage tyre|tyre care|save tyre|look after/.test(text)) keywords.push('MANAGE TYRES')
  // Race control
  if (/safety car/.test(text)) keywords.push('SAFETY CAR')
  if (/blue flag/.test(text)) keywords.push('BLUE FLAG')
  if (/box|pit stop|come in/.test(text)) keywords.push('BOX THIS LAP')
  // Braking
  if (/brake later|brake early|trail brake/.test(text)) keywords.push(`BRAKE${turn ? ` ${turn}` : ''}`)
  // ERS / Battery
  if (/battery|ers mode|engine mode/.test(text)) keywords.push('ERS MODE')
  return keywords.length > 0 ? keywords : []
}

function confidenceLabel(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return value || '—'
  return `${Math.round(numeric <= 1 ? numeric * 100 : numeric)}%`
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function requestRadioAnalysis(path, message, team, audioFeatures) {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, team: team.name, audioFeatures: audioFeatures || undefined }),
  })
  if (!response.ok) throw new Error('Radio analysis service unavailable')
  return response.json()
}

async function requestTranscription(audioBlob, direction, team) {
  const path = `/api/transcribe/${direction}?team=${encodeURIComponent(team.name)}`
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'content-type': audioBlob.type || 'audio/webm' },
    body: audioBlob,
  })
  if (!response.ok) throw new Error('Transcription service unavailable')
  return response.json()
}

// ─── Mic button component ─────────────────────────────────────────────────────

function MicButton({ onResult, onTranscribing, disabled }) {
  const { recording, error, start, stop } = useVoiceRecorder()
  const [phase, setPhase] = useState('idle') // idle | recording | processing

  const handleMouseDown = async () => {
    if (disabled || phase !== 'idle') return
    setPhase('recording')
    await start()
  }

  const handleMouseUp = async () => {
    if (phase !== 'recording') return
    setPhase('processing')
    const result = await stop()
    if (result) {
      onTranscribing?.(true)
      onResult?.(result)
    }
    setPhase('idle')
    onTranscribing?.(false)
  }

  // Keyboard support: hold space
  const handleKeyDown = (e) => { if (e.key === ' ' && phase === 'idle') { e.preventDefault(); handleMouseDown() } }
  const handleKeyUp = (e) => { if (e.key === ' ' && phase === 'recording') { e.preventDefault(); handleMouseUp() } }

  return (
    <div className="mic-control">
      <button
        id="mic-record-btn"
        className={`mic-button mic-${phase}`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={(e) => { e.preventDefault(); handleMouseDown() }}
        onTouchEnd={(e) => { e.preventDefault(); handleMouseUp() }}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        disabled={disabled || phase === 'processing'}
        aria-label={phase === 'recording' ? 'Release to send' : 'Hold to speak'}
      >
        {phase === 'recording' ? <Square size={14} /> : <Mic size={14} />}
        <span>
          {phase === 'recording' ? 'RELEASE TO SEND' : phase === 'processing' ? 'PROCESSING…' : 'HOLD TO SPEAK'}
        </span>
      </button>
      {error && <p className="mic-error">{error}</p>}
    </div>
  )
}

// ─── Radio Desk ───────────────────────────────────────────────────────────────

function RadioDesk({ team, onBack }) {
  const [driverMessage, setDriverMessage] = useState(driverSamples[0])
  const [engineerMessage, setEngineerMessage] = useState(engineerSamples[0])
  const [driverAnalysis, setDriverAnalysis] = useState(() => analyseDriverMessage(driverSamples[0]))
  const [driverDisplay, setDriverDisplay] = useState(() => extractEngineerKeywordsLocal(engineerSamples[0]))
  const [driverProvider, setDriverProvider] = useState('local demo rules')
  const [engineerProvider, setEngineerProvider] = useState('local demo rules')
  const [analysingDriver, setAnalysingDriver] = useState(false)
  const [analysingEngineer, setAnalysingEngineer] = useState(false)

  // Steering wheel keyword sequence
  const [wheelKeywords, setWheelKeywords] = useState([])
  const [showWheelKeywords, setShowWheelKeywords] = useState(false)

  // Trigger the steering wheel keyword animation
  const triggerWheelDisplay = useCallback((keywords) => {
    setWheelKeywords(keywords)
    setShowWheelKeywords(false)
    setTimeout(() => setShowWheelKeywords(true), 80)
    // After all keywords have played (keywords.length × 3s), reset
    setTimeout(() => setShowWheelKeywords(false), keywords.length * 3000 + 200)
  }, [])

  // ── Driver: text send ──
  const sendDriverMessage = async () => {
    setAnalysingDriver(true)
    try {
      const result = await requestRadioAnalysis('/api/analyse/driver', driverMessage, team, null)
      setDriverAnalysis(result)
      setDriverProvider(result.provider || 'radio analysis service')
    } catch {
      setDriverAnalysis(analyseDriverMessage(driverMessage))
      setDriverProvider('local demo fallback')
    } finally {
      setAnalysingDriver(false)
    }
  }

  // ── Driver: voice send ──
  const sendDriverVoice = async ({ blob, audioFeatures }) => {
    setAnalysingDriver(true)
    try {
      // Try server-side Whisper transcription + analysis
      const result = await requestTranscription(blob, 'driver', team)
      if (result.transcription) setDriverMessage(result.transcription)
      setDriverAnalysis(result)
      setDriverProvider(result.provider || 'whisper + analysis')
    } catch {
      // Fallback: analyse text already in textarea using client-side audio features
      const result = await requestRadioAnalysis('/api/analyse/driver', driverMessage, team, audioFeatures).catch(() => null)
      if (result) {
        setDriverAnalysis(result)
        setDriverProvider(result.provider || 'local fallback')
      } else {
        const fallback = analyseDriverMessage(driverMessage)
        // Apply audio-based mood override
        if (audioFeatures?.rms > 0.18) fallback.state = 'ANGRY'
        else if (audioFeatures?.rms > 0.08) fallback.state = 'FRUSTRATED'
        setDriverAnalysis(fallback)
        setDriverProvider('local fallback (no whisper)')
      }
    } finally {
      setAnalysingDriver(false)
    }
  }

  // ── Engineer: text send ──
  const sendEngineerMessage = async () => {
    setAnalysingEngineer(true)
    try {
      const result = await requestRadioAnalysis('/api/analyse/engineer', engineerMessage, team, null)
      const keywords = result.keywords?.length > 0 ? result.keywords : [result.keyword || 'CHECK RADIO']
      setDriverDisplay(keywords)
      setEngineerProvider(result.provider || 'radio analysis service')
      triggerWheelDisplay(keywords)
    } catch {
      const keywords = extractEngineerKeywordsLocal(engineerMessage)
      setDriverDisplay(keywords)
      setEngineerProvider('local demo fallback')
      triggerWheelDisplay(keywords)
    } finally {
      setAnalysingEngineer(false)
    }
  }

  // ── Engineer: voice send ──
  const sendEngineerVoice = async ({ blob }) => {
    setAnalysingEngineer(true)
    try {
      const result = await requestTranscription(blob, 'engineer', team)
      if (result.transcription) setEngineerMessage(result.transcription)
      const keywords = result.keywords?.length > 0 ? result.keywords : [result.keyword || 'CHECK RADIO']
      setDriverDisplay(keywords)
      setEngineerProvider(result.provider || 'whisper + analysis')
      triggerWheelDisplay(keywords)
    } catch {
      const keywords = extractEngineerKeywordsLocal(engineerMessage)
      setDriverDisplay(keywords)
      setEngineerProvider('local fallback (no whisper)')
      triggerWheelDisplay(keywords)
    } finally {
      setAnalysingEngineer(false)
    }
  }

  const mood = driverAnalysis?.mood || driverAnalysis?.state || 'CALM'

  return <section className="radio-desk-page">
    <StepHeader step={3} title={`${team.name.toUpperCase()} / RADIO DESK`} onBack={onBack} />
    <div className="desk-wrap">
      <div className="desk-intro">
        <button className="back-link" onClick={onBack}><ArrowLeft size={15} /> BACK TO COCKPIT LINK</button>
        <div className="soft-label"><span /> COMMUNICATION LOOP</div>
        <h1>Say it.<br /><em>Understand it.</em></h1>
        <p>Hold the mic button and speak, or type and send. The AI transcribes your voice, extracts key issues, and routes them instantly.</p>
      </div>

      <div className="radio-flow">
        {/* ── Driver panel ── */}
        <section className="message-panel" id="driver-panel">
          <div className="panel-title"><Mic size={15} /> DRIVER RADIO <span>01</span></div>
          <select value={driverMessage} onChange={(e) => setDriverMessage(e.target.value)}>
            <option value="">Select a demonstration message</option>
            {driverSamples.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <textarea value={driverMessage} onChange={(e) => setDriverMessage(e.target.value)} aria-label="Driver radio message" />
          <MicButton onResult={sendDriverVoice} disabled={analysingDriver} />
          <button className="send-button" onClick={sendDriverMessage} disabled={analysingDriver}>
            {analysingDriver ? 'ANALYSING…' : 'SEND TO ENGINEER'} <Send size={14} />
          </button>
        </section>

        {/* ── Engineer AI view ── */}
        <section className="engineer-view" id="engineer-ai-view">
          <span className="ai-label">AI INTERPRETATION</span>
          <div>
            <span>DRIVER MOOD</span>
            <b id="driver-mood-display" style={{ color: moodColor(mood) }}>{MOOD_LABEL[mood] || mood}</b>
          </div>
          <div>
            <span>ISSUE</span>
            <b>{driverAnalysis.issue}</b>
          </div>
          <div>
            <span>KEYWORD</span>
            <strong>{driverAnalysis.keyword}</strong>
          </div>
          <p>"{driverMessage}"</p>
          <small>CONFIDENCE {confidenceLabel(driverAnalysis.confidence)} / {driverProvider}</small>
        </section>

        {/* ── Engineer panel ── */}
        <section className="message-panel" id="engineer-panel">
          <div className="panel-title"><Volume2 size={15} /> ENGINEER RADIO <span>02</span></div>
          <select value={engineerMessage} onChange={(e) => setEngineerMessage(e.target.value)}>
            <option value="">Select a demonstration message</option>
            {engineerSamples.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <textarea value={engineerMessage} onChange={(e) => setEngineerMessage(e.target.value)} aria-label="Engineer radio message" />
          <MicButton onResult={sendEngineerVoice} disabled={analysingEngineer} />
          <button className="send-button" onClick={sendEngineerMessage} disabled={analysingEngineer}>
            {analysingEngineer ? 'COMPRESSING…' : 'SEND TO DRIVER'} <Send size={14} />
          </button>
        </section>

        {/* ── Driver steering wheel display ── */}
        <section className="driver-display" id="driver-wheel-display" data-active={showWheelKeywords ? 'true' : undefined}>
          <span>DRIVER DISPLAY / APPROVED MESSAGE</span>
          <div className="driver-display-wheel">
            <F1Wheel team={team} mode="engineer" setMode={() => {}} keywords={wheelKeywords} showKeywords={showWheelKeywords} />
          </div>
          <div className="driver-kw-list">
            {driverDisplay.map((kw, i) => (
              <b key={i} className={showWheelKeywords && wheelKeywords[i] ? 'kw-active' : ''}>{kw}</b>
            ))}
          </div>
          <small>WHITE COMMS MODE / {engineerProvider}</small>
        </section>
      </div>
    </div>
  </section>
}

// ─── Animated stat ─────────────────────────────────────────────────────────────

function AnimatedStat({ value }) {
  const match = String(value).match(/^(\D*)(\d+)(.*)$/)
  const prefix = match?.[1] || ''
  const numeric = match ? Number(match[2]) : null
  const suffix = match?.[3] || ''
  const [display, setDisplay] = useState(Number.isFinite(numeric) ? 0 : value)

  useEffect(() => {
    if (!Number.isFinite(numeric)) { setDisplay(value); return undefined }
    let frame
    const started = window.performance.now()
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / 900)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(numeric * eased))
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [numeric, value])

  return <b>{Number.isFinite(numeric) ? `${prefix}${display}${suffix}` : display}</b>
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [page, setPage] = useState('welcome')
  const [activeTeam, setActiveTeam] = useState(null)
  const selected = teams.find((team) => team.id === activeTeam)
  const audioRef = useRef(null)
  const [radioAudioActive, setRadioAudioActive] = useState(false)
  const startRadioAudio = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.play().then(() => setRadioAudioActive(true)).catch(() => setRadioAudioActive(false))
  }
  const stopRadioAudio = () => {
    const audio = audioRef.current
    if (audio) { audio.pause(); audio.currentTime = 0 }
    setRadioAudioActive(false)
  }
  const goTo = (nextPage) => {
    if (nextPage === 'radio' || nextPage === 'teams' || nextPage === 'welcome') stopRadioAudio()
    window.scrollTo({ top: 0, behavior: 'auto' })
    setPage(nextPage)
  }
  const selectTeam = (team) => {
    setActiveTeam(team.id)
    startRadioAudio()
    goTo('briefing')
  }

  return <main className={`app-shell page-${page}`} style={{ '--team': selected?.color || '#bffff0', '--accent': selected?.accent || '#ff8000' }}>
    <div className="film-grain" />
    <audio ref={audioRef} src={radioSound} preload="auto" aria-label="Team radio ambience" onEnded={() => setRadioAudioActive(false)} />
    {(page === 'welcome' || page === 'teams') && <>
      <video className="app-background-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
        <source src={openingVideo} type="video/mp4" />
      </video>
      <div className="app-background-video-shade" aria-hidden="true" />
    </>}
    {page === 'welcome' && <section className="welcome-page">
      <StepHeader step={1} onBack={() => setPage('welcome')} />
      <div className="welcome-copy">
        <div className="soft-label"><span /> F1 COMMUNICATION INTELLIGENCE</div>
        <h1>Welcome to<br /><em>the pit wall.</em></h1>
        <p>Welcome to your quiet teammate on the pit wall. Before the noise starts, let's set up your race context.</p>
        <button className="primary-action" onClick={() => goTo('teams')}>CHOOSE YOUR TEAM <ArrowUpRight size={17} /></button>
      </div>
      <div className="welcome-footer"><span><i /> SECURE RACE SESSION</span><span>THE SILENT CO-DRIVER / 01</span></div>
    </section>}

    {page === 'teams' && <section className="teams-page">
      <StepHeader step={2} onBack={() => setPage('welcome')} />
      <div className="selection-intro"><div className="soft-label"><span /> RACE CONTEXT</div><h1>Choose your<br /><em>team.</em></h1><p>We'll load a focused season briefing before opening the radio desk.</p></div>
      <div className="team-selector">
        {teams.map((team, index) => <button key={team.id} className="team-choice" style={{ '--card': team.color, '--cardAccent': team.accent }} onClick={() => selectTeam(team)}>
          <img src={team.image} alt="" /> <span className="photo-shade" />
          <span className="choice-number">0{index + 1}</span><span className="choice-code">{team.code}</span>
          <span className="choice-name">{team.name}</span><span className="choice-line" />
          <span className="choice-load">LOAD TEAM BRIEFING <ChevronRight size={17} /></span>
        </button>)}
      </div>
      <div className="selection-footer">SELECT ONE TEAM TO CONTINUE <span>⌄</span></div>
    </section>}

    {page === 'briefing' && selected && <section className="briefing-page">
      <StepHeader step={3} onBack={() => goTo('teams')} />
      <div className="briefing-wrap">
        <div className="briefing-title"><button className="back-link" onClick={() => goTo('teams')}><ArrowLeft size={15} /> CHANGE TEAM</button><div className="soft-label"><span /> TEAM BRIEFING / 2026</div><h1>{selected.name}<br /><em>season.</em></h1></div>
        <div className="team-portrait"><img src={selected.image} alt="" /><span /><div><b>{selected.code}</b><small>TEAM PROFILE LOADED</small></div></div>
        {selected.drivers?.length > 0 && <div className="driver-lineup">
          <div className="driver-lineup-heading"><span>DRIVER LINE-UP</span><i /> <small>RADIO CHANNELS READY</small></div>
          <div className="driver-cards">
            {selected.drivers.map((driver) => <article className="driver-card" key={driver.number}>
              <img src={driver.image} alt={driver.name} />
              <div className="driver-card-shade" />
              <div className="driver-card-info"><span className="driver-number">{driver.number}</span><div><b>{driver.name}</b><small>{driver.profile}</small></div></div>
              <div className="driver-signal"><i /><i /><i /><i /><span>RADIO ONLINE</span></div>
            </article>)}
          </div>
        </div>}
        <article className="briefing-data">
          <p className="briefing-summary">{selected.summary}</p>
          <div className="stat-grid"><div><span>CHAMPIONSHIP</span><AnimatedStat value={selected.position} /></div><div><span>POINTS</span><AnimatedStat value={selected.points} /></div><div><span>GP PODIUMS</span><AnimatedStat value={selected.podiums} /></div><div><span>ROUNDS</span><AnimatedStat value={selected.races} /></div></div>
          <div className="briefing-actions"><button className="primary-action next-action" onClick={() => goTo('cockpit')}>ENTER COCKPIT LINK <ArrowUpRight size={17} /></button><span><i /> RADIO DESK READY / TEAM CHANNEL LOCKED</span></div>
          <div className="copilot-note"><SparkleIcon size={17} /><div><span>COPILOT FOCUS</span><p>{selected.signal}</p></div></div>
          {selected.audioIssues?.length > 0 && <section className="audio-issues"><div className="audio-issues-heading"><div><span>RADIO ISSUES / SIGNAL HISTORY</span><small>WHY THIS TEAM CHANNEL NEEDS A COPILOT</small></div><i /></div><p className="audio-issues-intro">A compact season log of communication friction. Each event becomes a priority for the live radio desk.</p><div className="audio-issue-list">{selected.audioIssues.map((item, index) => <div className="audio-issue" key={item.event}><div className="audio-issue-index"><b>0{index + 1}</b><span>{item.event}</span></div><div className="audio-issue-copy"><strong>{item.label}</strong><p>{item.issue}</p></div><span className="issue-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span></div>)}</div></section>}
          <div className="source-line">SEASON SNAPSHOT: FORMULA1.COM RESULTS / CHECKED 10 AUG 2026</div>
        </article>
      </div>
      <div className="briefing-footer">DATA SHOULD INFORM THE DRIVER. NEVER DISTRACT THEM.</div>
    </section>}

    {page === 'cockpit' && selected && <CockpitLink team={selected} onBack={() => goTo('teams')} onStart={() => goTo('radio')} onDriverSpeak={startRadioAudio} />}
    {page === 'radio' && selected && <RadioDesk team={selected} onBack={() => goTo('cockpit')} />}
  </main>
}

export default App
