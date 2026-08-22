import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, ChevronRight, CircleDot, Mic, Radio, Send, Sparkles as SparkleIcon, Square, Volume2, X } from 'lucide-react'
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
import { historyAccessToken, isHistoryConfigured } from './supabase'

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

const MOOD_COLOUR = { ANGRY: '#ff4040', URGENT: '#ff4f5e', FRUSTRATED: '#ff9020', CALM: '#40d490', FOCUSED: '#40d490', REVIEW: '#f0b040', TIRED: '#8aa9f5' }
const MOOD_LABEL = { ANGRY: '⚠ ANGRY', URGENT: '‼ URGENT', FRUSTRATED: '! FRUSTRATED', CALM: '✓ CALM', FOCUSED: '✓ FOCUSED', REVIEW: '? UNCERTAIN', TIRED: '💤 TIRED' }

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
  const startTimeRef = useRef(null)

  const start = useCallback(async () => {
    setError(null)
    transcriptRef.current = ''
    startTimeRef.current = Date.now()

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
      const recordingDurationSec = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0

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
        resolve({ transcript, blob, audioFeatures, recordingDurationSec })
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

function F1Wheel({ team, keywords, showKeywords, controlsEnabled = true, engineerRecording, driverRecording, onEngineerDown, onEngineerUp, onDriverDown, onDriverUp, lapState = 'idle', lapReady = true, lapAvailabilityLabel = '', onStartLap, onStopLap }) {
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
  const engineerModeReady = controlsEnabled && (lapState === 'idle' || lapState === 'running') && !engineerRecording && !driverRecording
  const engineerModeButtonLabel = lapState === 'running'
    ? 'STOP LAP'
    : engineerModeReady ? 'START LAP'
    : !controlsEnabled ? 'LOCK WHEEL'
    : 'RUN COMPLETE'

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
      <g
        className={`wheel-hit ${engineerModeReady ? 'wheel-engineer-mode' : 'is-disabled'}`}
        role="button"
        tabIndex={engineerModeReady ? '0' : '-1'}
        aria-disabled={!engineerModeReady}
        aria-label={lapState === 'running' ? 'Stop lap replay and open Engineer Mode' : lapState === 'finished' ? 'Open Engineer Mode from the completed lap panel' : !lapReady ? `${lapAvailabilityLabel || 'Replay data loading'}. Start the built-in lap animation.` : controlsEnabled ? 'Start lap replay in Engineer Mode' : 'Engineer Mode locked until wheel is engaged'}
        style={{ cursor: engineerModeReady ? 'pointer' : 'not-allowed' }}
        onClick={() => engineerModeReady && (lapState === 'running' ? onStopLap?.() : onStartLap?.())}
        onKeyDown={(event) => engineerModeReady && (event.key === 'Enter' || event.key === ' ') && (lapState === 'running' ? onStopLap?.() : onStartLap?.())}
      >
        <circle cx="500" cy="415" r="34" fill={engineerModeReady ? accent : '#111b1c'} stroke={engineerModeReady ? '#f4fff9' : '#83a79b'} strokeWidth={engineerModeReady ? '3.5' : '3'} />
        {engineerModeReady && <circle cx="500" cy="415" r="40" fill="none" stroke={accent} strokeWidth="2" opacity=".3"><animate attributeName="r" values="34;43;34" dur="1.4s" repeatCount="indefinite" /><animate attributeName="opacity" values=".45;.05;.45" dur="1.4s" repeatCount="indefinite" /></circle>}
        <text x="500" y="409" textAnchor="middle" fill={engineerModeReady ? '#06100e' : '#dcfff4'} fontSize="10" fontWeight="700" fontFamily="DM Mono">ENG</text>
        <text x="500" y="425" textAnchor="middle" fill={engineerModeReady ? '#06100e' : '#91aaa1'} fontSize="6.8" fontWeight="700" fontFamily="DM Mono" letterSpacing=".6">{engineerModeButtonLabel}</text>
      </g>
      <text x="500" y="462" textAnchor="middle" fill={engineerModeReady ? accent : '#718780'} fontSize="7" fontFamily="DM Mono" letterSpacing="1.3">ENGINEER MODE</text>

      {/* LEFT = ENGINEER RADIO, RIGHT = DRIVER RADIO (swapped per spec) */}
      {holdButton(128, 139, 'ENGINEER RADIO', engineerRecording, onEngineerDown, onEngineerUp)}
      {holdButton(760, 139, 'DRIVER RADIO', driverRecording, onDriverDown, onDriverUp)}

      <text x="184" y="530" fill="#7d9990" fontSize="11" fontFamily="DM Mono" letterSpacing="2">ENGINEER</text>
      <text x="741" y="530" fill="#7d9990" fontSize="11" fontFamily="DM Mono" letterSpacing="2">DRIVER</text>
    </g>
  </svg>
}

function normaliseTrackPoints(points, width, height, padding = 22) {
  const valid = (points || []).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  if (valid.length < 2) return []
  const xs = valid.map((point) => point.x)
  const ys = valid.map((point) => point.y)
  const minX = Math.min(...xs); const maxX = Math.max(...xs)
  const minY = Math.min(...ys); const maxY = Math.max(...ys)
  const scale = Math.min((width - padding * 2) / Math.max(1, maxX - minX), (height - padding * 2) / Math.max(1, maxY - minY))
  return valid.map((point) => ({
    x: padding + (point.x - minX) * scale,
    y: height - padding - (point.y - minY) * scale,
  }))
}

function lapTimeLabel(seconds) {
  if (!Number.isFinite(seconds)) return '—'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}

function emotionColour(mood) {
  return MOOD_COLOUR[mood] || '#9db3ab'
}

// The default layer is intentionally an annotated demo scenario, not a claim
// about a historic driver's private emotion. Real radio events replace it when
// the user records a message during the replay.
function demoEmotionScenario(duration) {
  return [
    { progress: .06, mood: 'CALM', label: 'OPENING PHASE', detail: 'Stable opening inputs.', source: 'DEMO ANNOTATION' },
    { progress: .32, mood: 'FOCUSED', label: 'HIGH-LOAD CURVES', detail: 'High attention through successive corners.', source: 'DEMO ANNOTATION' },
    { progress: .58, mood: 'FRUSTRATED', label: 'POSITION BATTLE', detail: 'Illustrative grip complaint under pressure.', source: 'DEMO ANNOTATION' },
    { progress: .84, mood: 'CALM', label: 'RECOVERY PHASE', detail: 'Communication returns to a steady tone.', source: 'DEMO ANNOTATION' },
  ].map((event) => ({ ...event, seconds: duration * event.progress }))
}

function EmotionLens({ currentLap, referenceLap, radioEvents = [], conversationLog = [] }) {
  const duration = currentLap?.duration || 90
  const usingLiveEvents = radioEvents.length > 0 || conversationLog.length > 0
  const demoEvents = demoEmotionScenario(duration)
  const delta = currentLap && referenceLap ? currentLap.duration - referenceLap.duration : null

  // For the dot timeline: use driver-only entries from conversationLog (they have a mood),
  // falling back to radioEvents, then demo scenario dots.
  const timelineDots = conversationLog.length > 0
    ? conversationLog.filter(e => e.role === 'driver').map((e, i) => ({ ...e, progress: 0.1 + (i / Math.max(1, conversationLog.filter(x => x.role === 'driver').length - 1)) * 0.8, seconds: 0 }))
    : radioEvents.length > 0
    ? radioEvents
    : demoEvents

  const highestEvent = [...timelineDots].sort((l, r) => ({ CALM: 0, FOCUSED: 1, REVIEW: 1, FRUSTRATED: 2, URGENT: 3, ANGRY: 4, TIRED: 1 }[r.mood] || 0) - ({ CALM: 0, FOCUSED: 1, REVIEW: 1, FRUSTRATED: 2, URGENT: 3, ANGRY: 4, TIRED: 1 }[l.mood] || 0))[0]
  const deltaSentence = delta == null ? 'The lap-time comparison is loading.' : `The selected lap was ${Math.abs(delta).toFixed(3)}s ${delta < 0 ? 'faster' : 'slower'} than its real reference lap.`

  // Ref for the scrollable timeline — auto-scroll to right on new entries
  const timelineRef = useRef(null)
  useEffect(() => {
    if (timelineRef.current) timelineRef.current.scrollLeft = timelineRef.current.scrollWidth
  }, [timelineDots.length])

  // Ref for conversation — auto-scroll to bottom on new message
  const logRef = useRef(null)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [conversationLog.length])

  return <section className="emotion-lens" aria-label="Emotion lens">
    <div className="emotion-lens-head">
      <div><span>EMOTION LENS / RADIO CONTEXT</span><h3>Driver state across the lap</h3></div>
      <b className={usingLiveEvents ? 'is-live' : ''}>{usingLiveEvents ? 'LIVE RADIO OVERLAY' : 'DEMO OVERLAY'}</b>
    </div>

    {/* ── Scrollable mood dot timeline ── */}
    <div className="emotion-track-scroll" ref={timelineRef} aria-label="Emotion timeline">
      <div className="emotion-track-inner">
        <div className="emotion-track-line" />
        {timelineDots.map((event, index) => (
          <div key={`dot-${index}`} className="emotion-event emotion-event-pinned" style={{ '--emotion': emotionColour(event.mood) }}>
            <i />
            <strong>{event.mood}</strong>
            <small>{event.ts || lapTimeLabel(event.seconds)}</small>
          </div>
        ))}
      </div>
    </div>

    {/* ── Conversation log OR demo cards ── */}
    {conversationLog.length > 0 ? (
      <div className="conv-log" ref={logRef}>
        {conversationLog.map((entry) => {
          const isDriver = entry.role === 'driver'
          const isEngineer = entry.role === 'engineer'
          const isAI = entry.role === 'ai'
          return (
            <article
              key={entry.id}
              className={`conv-entry conv-${entry.role}`}
              style={{
                '--conv-color': isDriver ? emotionColour(entry.mood) : '#8b5cf6',
              }}
            >
              <div className="conv-meta">
                <span className="conv-role">
                  {isDriver ? `DRIVER · ${entry.mood}` : isEngineer ? 'ENGINEER RADIO' : `PITWALL AI · ${entry.issue}`}
                </span>
                <span className="conv-ts">{entry.ts}</span>
              </div>
              {entry.issue && isDriver && <b className="conv-issue">{entry.issue}</b>}
              <p className="conv-text">"{entry.text}"</p>
            </article>
          )
        })}
      </div>
    ) : (
      <div className="emotion-events">
        {demoEvents.map((event, index) => <article key={`${event.label}-${index}`} style={{ '--emotion': emotionColour(event.mood) }}>
          <span>{event.mood} / {lapTimeLabel(event.seconds)}</span>
          <b>{event.label || event.issue || 'RADIO EVENT'}</b>
          <p>{event.detail || event.transcript || 'Driver radio emotion detected during the replay.'}</p>
        </article>)}
      </div>
    )}

    <div className="emotion-insight">
      <span>EXPLAINABLE OBSERVATION</span>
      <p>{highestEvent ? `${highestEvent.mood} signal ${usingLiveEvents ? `recorded at ${highestEvent.ts || lapTimeLabel(highestEvent.seconds)}` : 'shown in the demo scenario'}. ` : ''}{deltaSentence} Emotion is contextual evidence, not proof that it caused the lap-time change.</p>
    </div>
  </section>
}

function LapRunConsole({ team, lapState, lapProgress, driverTranscript, engineerTranscript, autoEngineerReply, driverMood, driverIssue, replayData, onEngineerMode, uploadState, uploadMessage, onUploadNow }) {
  const actualLap = replayData?.comparison?.current
  const track = normaliseTrackPoints(replayData?.track_position, 420, 220, 30)
  const car = track[Math.min(track.length - 1, Math.round(lapProgress * Math.max(0, track.length - 1)))]
  const activeEvent = lapProgress < .22 ? 'GRID EXIT' : lapProgress < .48 ? 'SECTOR 1' : lapProgress < .76 ? 'RADIO WINDOW' : lapProgress < 1 ? 'SECTOR 3' : 'FINISH'
  const angle = lapProgress * Math.PI * 2 - Math.PI / 2
  const carX = 50 + Math.cos(angle) * 34 + Math.sin(angle * 3) * 5
  const carY = 50 + Math.sin(angle) * 27 + Math.cos(angle * 2) * 4
  const timeline = [
    ['GRID EXIT', 0, '00:00'], ['S1', .24, actualLap ? `${actualLap.sector_1.toFixed(3)}s` : '—'], ['RADIO', .52, 'LIVE'], ['S3', .78, actualLap ? `${actualLap.sector_3.toFixed(3)}s` : '—'], ['FINISH', 1, actualLap ? lapTimeLabel(actualLap.duration) : '—'],
  ]

  return <section className={`lap-run-console lap-${lapState}`} aria-label="Lap simulation">
    <article className="lap-radio-feed">
      <div className="lap-panel-label"><i /> LIVE RADIO</div>
      <div><span>DRIVER</span><b>{driverTranscript || 'CHANNEL ARMED — HOLD DRIVER RADIO TO SPEAK'}</b></div>
      <div><span>{autoEngineerReply ? 'PITWALL AI' : 'ENGINEER'}</span><b>{autoEngineerReply || engineerTranscript || 'CHANNEL ARMED — HOLD ENGINEER RADIO TO SPEAK'}</b></div>
      <small>{driverMood ? `${driverMood} / ${driverIssue || 'ISSUE PENDING'}` : 'WAITING FOR FIRST MESSAGE'}</small>
    </article>

    <article className="lap-track-card">
      <div className="lap-panel-label"><i /> {lapState === 'finished' ? 'RUN COMPLETE' : `${replayData?.session?.circuit_short_name || 'CIRCUIT'} / LIVE RUN`}</div>
      <svg viewBox="0 0 420 220" role="img" aria-label="Simplified circuit with animated car">
        {track.length > 1 ? <>
          <polyline points={track.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#344b46" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={track.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={team.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 9" opacity=".85" />
          {car && <><circle cx={car.x} cy={car.y} r="10" fill={team.color} stroke="#effff9" strokeWidth="3" /><path d={`M ${car.x - 4} ${car.y + 5} L ${car.x + 8} ${car.y} L ${car.x - 4} ${car.y - 5} Z`} fill="#07100e" /></>}
        </> : <><path d="M69 111 C69 57 127 35 178 56 C223 20 317 38 341 82 C374 139 320 185 257 167 C215 203 121 190 84 151 C69 136 65 124 69 111Z" fill="none" stroke="#344b46" strokeWidth="13" strokeLinecap="round" /><path d="M69 111 C69 57 127 35 178 56 C223 20 317 38 341 82 C374 139 320 185 257 167 C215 203 121 190 84 151 C69 136 65 124 69 111Z" fill="none" stroke={team.color} strokeWidth="3" strokeLinecap="round" strokeDasharray="6 9" opacity=".8" /><circle cx={carX * 4.2} cy={carY * 2.2} r="10" fill={team.color} stroke="#effff9" strokeWidth="3" /></>}
      </svg>
      <div className="lap-track-readout"><b>{actualLap ? lapTimeLabel(lapProgress * actualLap.duration) : `${String(Math.round(lapProgress * 100)).padStart(2, '0')}%`}</b><span>{actualLap ? `ACTUAL LAP ${actualLap.lap_number}` : activeEvent}</span></div>
    </article>

    <article className="lap-timeline-panel">
      <div className="lap-panel-label"><i /> LAP TIMELINE</div>
      <div className="lap-timeline-line"><i style={{ height: `${lapProgress * 100}%` }} /></div>
      <ol>{timeline.map(([label, at, value]) => <li key={label} className={lapProgress >= at ? 'is-passed' : ''}><span>{label}</span><b>{value}</b></li>)}</ol>
      <button type="button" className={`lap-upload-button is-${uploadState}`} onClick={onUploadNow} disabled={uploadState === 'uploading' || uploadState === 'unavailable'}>
        {uploadState === 'uploading' ? 'UPLOADING…' : uploadState === 'saved' ? 'UPLOAD SAVED ✓' : 'UPLOAD TO SUPABASE'}
      </button>
      <small className={`lap-upload-state is-${uploadState}`}>{uploadMessage}</small>
      <button type="button" onClick={onEngineerMode} disabled={lapState !== 'finished'}>ENGINEER MODE <ArrowUpRight size={13} /></button>
    </article>
  </section>
}

function EngineerMode({ team, driverTranscript, driverIssue, driverMood, driverTrackContext = null, radioEvents, autoEngineerResponse, replayData, replayError = '', stoppedEarly = false, stoppedAt = 0, onClose, stressMetrics, setStressTemp, setStressTrackTemp, setStressGForce, setStressLap, conversationLog = [] }) {
  const [issueFocused, setIssueFocused] = useState(false)
  const [manualReview, setManualReview] = useState({ battle: 'NOT REVIEWED', drs: 'NOT REVIEWED', trackState: 'AUTO' })
  const issue = driverIssue || 'AWAITING RADIO REPORT'
  const report = driverTranscript || 'No driver radio has been captured for this run yet.'
  const currentLap = replayData?.comparison?.current
  const referenceLap = replayData?.comparison?.reference
  const delta = replayData?.comparison?.delta_seconds
  const track = normaliseTrackPoints(replayData?.track_position, 860, 560, 64)
  const trackPolyline = track.map((point) => `${point.x},${point.y}`).join(' ')
  const radioEvent = radioEvents?.at(-1)
  const trackContext = driverTrackContext || radioEvent?.trackContext || null
  const markerProgress = radioEvent?.progress ?? trackContext?.progress ?? .58
  const markerIndex = Math.min(track.length - 1, Math.max(0, Math.round(markerProgress * Math.max(0, track.length - 1))))
  const marker = track[markerIndex]
  const turnPoints = (replayData?.turn_markers || []).map((turn) => ({
    ...turn,
    point: track[Math.min(track.length - 1, Math.max(0, Math.round(turn.progress * Math.max(0, track.length - 1))))],
  })).filter((turn) => turn.point)
  const issueZone = driverIssue ? track.slice(Math.max(0, markerIndex - 9), Math.min(track.length, markerIndex + 10)) : []
  const issueZonePoints = issueZone.map((point) => `${point.x},${point.y}`).join(' ')
  const carData = replayData?.car_data || []
  const telemetry = carData[Math.min(carData.length - 1, Math.max(0, Math.round(markerProgress * Math.max(0, carData.length - 1))))]
  const weather = replayData?.weather?.at(-1)
  const tyreStatus = /TYRE|WHEEL|FRONT|REAR|GRIP/.test(issue) ? `${issue} / REVIEW` : 'NO TYRE FLAG'
  const strategyStatus = stoppedEarly ? 'EARLY REVIEW' : radioEvent ? 'RADIO REVIEW' : 'BASELINE PLAN'
  const driverName = replayData?.selected_driver?.full_name || team.drivers?.[0]?.name || 'DRIVER'
  const deltaLabel = Number.isFinite(delta) ? `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}s` : '—'

  const [wave, setWave] = useState(Array.from({ length: 30 }, () => 50))
  useEffect(() => {
    const waveInterval = setInterval(() => {
      setWave(prev => {
        const nextWave = [...prev.slice(1)]
        const lastVal = prev[prev.length - 1]
        let nextVal = lastVal + (Math.random() * 16 - 8)
        if (nextVal > 90) nextVal = 75
        if (nextVal < 10) nextVal = 25
        nextWave.push(nextVal)
        return nextWave
      })
    }, 90)
    return () => clearInterval(waveInterval)
  }, [])

  const wavePath = wave.map((val, i) => {
    const wx = 389 + i * (222 / (wave.length - 1))
    const wy = 352 + (val - 50) * 0.16
    return `${i === 0 ? 'M' : 'L'} ${wx} ${wy}`
  }).join(' ')

  return <section className="engineer-mode engineer-console" role="dialog" aria-modal="true" aria-label="Engineer Mode track comparison">
    <header className="engineer-mode-top">
      <div><span>ENGINEER MODE / LIVE REVIEW</span><h2>PIT WALL</h2></div>
      <div className="engineer-session-meta"><span>{replayData?.session?.circuit_short_name || 'CIRCUIT'} / 2023 RACE</span><b>{driverName.toUpperCase()}</b></div>
      <button type="button" onClick={onClose}><X size={16} /> CLOSE</button>
    </header>

    <div className="engineer-console-grid">
      <section className="engineer-map-pane">
        <div className="map-pane-head"><span><i /> TRACK MAP / RADIO POSITION</span><b>{trackContext?.label || (stoppedEarly ? `STOPPED ${lapTimeLabel(stoppedAt)}` : 'RUN REVIEW')}</b></div>
        <svg viewBox="0 0 860 560" role="img" aria-label="Circuit map with the driver radio issue highlighted">
          {track.length > 1 ? <>
            <polyline points={trackPolyline} fill="none" stroke="#263a36" strokeWidth="27" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={trackPolyline} fill="none" stroke="#dcebe6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="11 14" opacity=".72" />
            <polyline points={trackPolyline} fill="none" stroke={team.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".58" />
            {turnPoints.map((turn) => <g className="track-turn-marker" key={`turn-${turn.number}`}>
              <circle cx={turn.point.x} cy={turn.point.y} r="11" />
              <text x={turn.point.x} y={turn.point.y + 3.5}>{turn.number}</text>
            </g>)}
            {issueZone.length > 1 && <polyline points={issueZonePoints} fill="none" stroke="#f21f2d" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" className="issue-zone-line" />}
            {marker && <>
              <g className="track-issue-target" role="button" tabIndex="0" aria-label="Focus the reported issue on the track" onClick={() => setIssueFocused((focused) => !focused)} onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && setIssueFocused((focused) => !focused)}>
                <circle cx={marker.x} cy={marker.y} r="30" fill="#f21f2d" opacity=".18"><animate attributeName="r" values="22;39;22" dur="1.8s" repeatCount="indefinite" /></circle>
                <circle cx={marker.x} cy={marker.y} r="15" fill="#f21f2d" stroke="#f0fff9" strokeWidth="4" />
                <path d={`M ${marker.x + 16} ${marker.y - 16} L ${marker.x + 66} ${marker.y - 58}`} fill="none" stroke="#f21f2d" strokeWidth="2" />
                <rect x={Math.min(marker.x + 66, 628)} y={Math.max(marker.y - (issueFocused ? 126 : 105), 20)} width="200" height={issueFocused ? "79" : "58"} rx="5" fill="#08100f" stroke="#f21f2d" strokeWidth="1.3" />
                <text x={Math.min(marker.x + 77, 639)} y={Math.max(marker.y - (issueFocused ? 103 : 82), 43)} fill="#f21f2d" fontSize="10" fontFamily="DM Mono, monospace" letterSpacing="1.2">{issueFocused ? 'ISSUE FOCUS / CLICK TO CLOSE' : 'DRIVER REPORT / CLICK TO FOCUS'}</text>
                <text x={Math.min(marker.x + 77, 639)} y={Math.max(marker.y - (issueFocused ? 82 : 61), 64)} fill="#effff9" fontSize="15" fontWeight="700" fontFamily="Space Grotesk, sans-serif">{issue}</text>
                {issueFocused && <text x={Math.min(marker.x + 77, 639)} y={Math.max(marker.y - 60, 85)} fill="#a9bdb6" fontSize="9" fontFamily="DM Mono, monospace">{driverMood || 'RADIO'} / {lapTimeLabel(radioEvent?.seconds ?? markerProgress * (currentLap?.duration || 0))}</text>}
              </g>
            </>}
          </> : <>
            <text x="430" y="268" fill="#f0b040" textAnchor="middle" fontSize="14" fontFamily="DM Mono, monospace">{replayError ? 'TRACK API OFFLINE' : 'TRACK DATA LOADING'}</text>
            <text x="430" y="296" fill="#95aaa3" textAnchor="middle" fontSize="10" fontFamily="DM Mono, monospace">{replayError ? 'START BACKEND / PORT 8787' : 'CONNECTING TO REPLAY SOURCE'}</text>
          </>}
        </svg>
        <div className="map-event-log"><span>RADIO LOG</span><b>{driverName} / {driverMood || 'NO EMOTION SIGNAL'} / {issue}</b><p>“{report}”</p>{trackContext && <small>{trackContext.label} · {trackContext.sampledSpeedKph ?? '—'} KM/H · {trackContext.trackState}</small>}</div>
        <div className="track-legend"><span><i /> CURRENT LAP</span><span><i /> REFERENCE LAP</span><span><i /> TURN MARKER</span><span><i /> ISSUE ZONE</span></div>
      </section>

      <aside className="engineer-data-pane">
        <div className="data-pane-head"><span><i /> PIT WALL DATA</span><b>ACTUAL / 2023</b></div>
        <div className="data-primary"><span>CURRENT LAP</span><strong>{currentLap ? lapTimeLabel(currentLap.duration) : '—'}</strong><p>Lap {currentLap?.lap_number ?? '—'} / Δ {deltaLabel} vs reference</p></div>
        <div className="engineer-data-grid">
          <article><span>STRATEGY</span><b>{strategyStatus}</b><small>{stoppedEarly ? 'Manual review opened' : 'Human approval required'}</small></article>
          <article><span>TYRE STATUS</span><b>{tyreStatus}</b><small>AI radio assessment</small></article>
          <article><span>TRACK TEMP</span><b>{Number.isFinite(weather?.track_temperature) ? `${weather.track_temperature.toFixed(1)}°C` : '—'}</b><small>Historic session weather</small></article>
          <article><span>AIR TEMP</span><b>{Number.isFinite(weather?.air_temperature) ? `${weather.air_temperature.toFixed(1)}°C` : '—'}</b><small>Humidity {weather?.humidity ?? '—'}%</small></article>
          <article><span>EVENT SPEED</span><b>{Number.isFinite(telemetry?.speed) ? `${telemetry.speed} KM/H` : '—'}</b><small>Throttle {telemetry?.throttle ?? '—'}%</small></article>
          <article><span>BRAKE / GEAR</span><b>{telemetry?.brake ? 'BRAKING' : 'OFF BRAKE'}</b><small>Gear {telemetry?.gear ?? '—'}</small></article>
        </div>
        <section className="manual-review-card">
          <span>RADIO POSITION / MANUAL REVIEW</span>
          <b>{trackContext?.label || 'AWAITING TRACK CONTEXT'}</b>
          <p>{trackContext ? `${trackContext.sampledSpeedKph ?? '—'} KM/H at report · Gear ${trackContext.sampledGear ?? '—'} · ${trackContext.sampledBrake ? 'braking' : 'off brake'}` : 'Record driver radio while the replay data is loaded to attach turn and speed context.'}</p>
          <div className="manual-review-controls">
            <label>BATTLE<select value={manualReview.battle} onChange={(event) => setManualReview((review) => ({ ...review, battle: event.target.value }))}><option>NOT REVIEWED</option><option>IN BATTLE</option><option>CLEAR AIR</option></select></label>
            <label>DRS<select value={manualReview.drs} onChange={(event) => setManualReview((review) => ({ ...review, drs: event.target.value }))}><option>NOT REVIEWED</option><option>DRS ON</option><option>DRS OFF</option></select></label>
            <label>TRACK<select value={manualReview.trackState} onChange={(event) => setManualReview((review) => ({ ...review, trackState: event.target.value }))}><option>AUTO</option><option>CORNER</option><option>STRAIGHT</option></select></label>
          </div>
        </section>
        <section className="engineer-action-card"><span>COPILOT ACTION</span><b>{autoEngineerResponse?.display || 'AWAIT ENGINEER'}</b><p>{autoEngineerResponse?.reply || 'No automated response is attached yet. Use the driver radio to create one.'}</p></section>
      </aside>
    </div>

    {stressMetrics && (
      <div className="stress-card">
        <div className="stress-card-head">
          <span>DRIVER PHYSICAL STRESS MONITOR</span>
          <h3>Cockpit Environment & Biometrics</h3>
        </div>
        
        <div className="stress-card-grid">
          <div className="stress-card-top-row">
            <div className="stress-card-top-left">
              <span className="stress-sub-label">CURRENT PHYSICAL STRESS LEVEL</span>
              <div className={`stress-status-display stress-level-${stressMetrics.psi >= 70 ? (stressMetrics.hydration < 15 ? 'critical' : 'tired') : (stressMetrics.psi >= 45 ? 'elevated' : 'calm')}`}>
                <div className="stress-status-text">
                  <strong>{stressMetrics.level}</strong>
                  <small>PSI Score: {stressMetrics.psi} / 100</small>
                </div>
              </div>
            </div>
            
            <div className="stress-card-top-right">
              <span className="stress-sub-label">DRIVER BIOMETRIC READOUT</span>
              <div className="biometric-readout-grid">
                <div className="biometric-item">
                  <div className="biometric-values">
                    <label>EST. HEART RATE</label>
                    <strong>{stressMetrics.hr} <small>bpm</small></strong>
                  </div>
                </div>
                <div className="biometric-item">
                  <div className="biometric-values">
                    <label>EST. BREATHING RATE</label>
                    <strong>{stressMetrics.br} <small>bpm</small></strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="stress-card-bottom-row">
            <span className="stress-sub-label">LIVE TELEMETRY CONFIGURATOR</span>
            <div className="engineer-data-grid stress-stats-grid">
              <article className="stress-stat-editable">
                <span>COCKPIT TEMP</span>
                <b>
                  <input 
                    type="number" 
                    value={stressMetrics.temp} 
                    onChange={(e) => setStressTemp(parseFloat(e.target.value) || 0)} 
                    step="0.1" 
                  />
                  <small className="unit">°C</small>
                </b>
                <small>Simulation cockpit heat</small>
              </article>
              
              <article className="stress-stat-editable">
                <span>TRACK TEMP</span>
                <b>
                  <input 
                    type="number" 
                    value={stressMetrics.trackTemp} 
                    onChange={(e) => setStressTrackTemp(parseFloat(e.target.value) || 0)} 
                    step="0.1" 
                  />
                  <small className="unit">°C</small>
                </b>
                <small>Track surface temperature</small>
              </article>

              <article className="stress-stat-editable">
                <span>CURRENT LAP</span>
                <b>
                  <input 
                    type="number" 
                    value={stressMetrics.lap} 
                    onChange={(e) => setStressLap(parseInt(e.target.value) || 1)} 
                    step="1" 
                  />
                  <small className="unit">/ 78</small>
                </b>
                <small>Current lap number</small>
              </article>

              <article className="stress-stat-editable">
                <span>AVG G-FORCE</span>
                <b>
                  <input 
                    type="number" 
                    value={stressMetrics.gforce} 
                    onChange={(e) => setStressGForce(parseFloat(e.target.value) || 0)} 
                    step="0.1" 
                  />
                  <small className="unit">G</small>
                </b>
                <small>Average lateral Gs</small>
              </article>

              <article className="readonly">
                <span>REMAINING HYDRATION</span>
                <b className={stressMetrics.hydration < 15 ? 'critical-text' : ''}>
                  {stressMetrics.hydration}
                  <small className="unit">%</small>
                </b>
                <small className={stressMetrics.hydration < 15 ? 'critical-text' : ''}>Driver hydration level</small>
              </article>

              <article className="readonly">
                <span>PHYSICAL STRESS INDEX</span>
                <b className={stressMetrics.psi >= 70 ? 'critical-text' : ''}>
                  {stressMetrics.psi}
                  <small className="unit">/ 100</small>
                </b>
                <small className={stressMetrics.psi >= 70 ? 'critical-text' : ''}>Composite stress level</small>
              </article>
            </div>
            
            {/* Real-time telemetry ECG wave drawing at the bottom */}
            <svg viewBox="371 340 258 20" style={{ height: '20px', width: '100%', marginTop: '15px' }}>
              <path d={wavePath} fill="none" stroke="#5d746f" strokeWidth="1.5" opacity="0.6" />
            </svg>
          </div>
        </div>
      </div>
    )}

    <EmotionLens currentLap={currentLap} referenceLap={referenceLap} radioEvents={radioEvents} conversationLog={conversationLog} />
  </section>
}

// ─── Cockpit Link — main interactive page ────────────────────────────────────
// Engineer button (left) and Driver button (right) are hold-to-speak mics.
// Left panel shows engineer transcript, right shows driver transcript + mood.

function CockpitLink({ team, onBack, onStart, onDriverSpeak }) {
  const sequenceRef = useRef()
  const lockedScrollYRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const [lapState, setLapState] = useState('idle')
  const [lapProgress, setLapProgress] = useState(0)
  const [engineerMode, setEngineerMode] = useState(false)
  const [lapStoppedEarly, setLapStoppedEarly] = useState(false)
  const [replayCircuit, setReplayCircuit] = useState('bahrain')
  const [replayData, setReplayData] = useState(null)
  const [replayLoading, setReplayLoading] = useState(true)
  const [replayError, setReplayError] = useState('')
  const [replayRequest, setReplayRequest] = useState(0)

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
  const [autoEngineerResponse, setAutoEngineerResponse] = useState(null)
  const [driverConfidence, setDriverConfidence] = useState(null)
  const [driverTrackContext, setDriverTrackContext] = useState(null)
  const [driverTimestamp, setDriverTimestamp] = useState('')
  const [driverProcessing, setDriverProcessing] = useState(false)
  const [radioEvents, setRadioEvents] = useState([])
  // Full conversation history: [{id, role:'driver'|'engineer'|'ai', text, mood, issue, ts}]
  const [conversationLog, setConversationLog] = useState([])

  // One Supabase session represents one started lap. It is created automatically
  // and is finished as either completed or stopped when the run ends.
  const historySessionRef = useRef(null)
  const historyFinishingRef = useRef(false)
  const historyStartingRef = useRef(null)
  const [uploadState, setUploadState] = useState(isHistoryConfigured ? 'idle' : 'unavailable')
  const [uploadMessage, setUploadMessage] = useState(isHistoryConfigured
    ? 'AUTO-SAVES AT LAP START AND FINISH'
    : 'ADD VITE_SUPABASE VALUES TO frontend/.env')

  // Wheel keyword display
  const [wheelKeywords, setWheelKeywords] = useState([])
  const [showWheelKeywords, setShowWheelKeywords] = useState(false)

  // Telemetry dropdown state for Physical Stress Index (PSI) modeling
  const [stressTemp, setStressTemp] = useState(26.2)
  const [stressTrackTemp, setStressTrackTemp] = useState(28.7)
  const [stressGForce, setStressGForce] = useState(1.9)
  const [stressLap, setStressLap] = useState(50)
  // null = calculated from formula; number = user-pinned value via dropdown
  const [stressHydrationOverride, setStressHydrationOverride] = useState(null)

  const stressMetrics = useMemo(() => {
    // Effective Cockpit Temp Index (baseline humidity = 21%)
    const tIndex = stressTemp + (0.55 * 0.21 * (stressTemp - 14.5))
    
    // Dehydration drop per lap (%)
    const dropPerLap = 0.5 + Math.pow(tIndex / 30, 2) * (1 + 0.1 * stressGForce)
    const calculatedHydration = Math.max(5, Number((100 - (dropPerLap * stressLap)).toFixed(1)))
    // If user has locked a hydration value via dropdown, use it directly
    const hydration = stressHydrationOverride !== null ? stressHydrationOverride : calculatedHydration
    
    // Physical Stress Index (PSI, 0-100) - Correlated to specific user guidelines
    
    // 1. Cockpit Temp correlation (<=20 = good, >28 = alarming, >34 = dangerous)
    let tempLoad = 0
    if (stressTemp > 34) tempLoad = 30 + (stressTemp - 34) * 3
    else if (stressTemp > 28) tempLoad = 10 + (stressTemp - 28) * 3.33
    else if (stressTemp > 20) tempLoad = (stressTemp - 20) * 1.25

    // 2. Track Temp correlation (Radiates heat: >45 = dangerous, >35 = alarming)
    let trackTempLoad = 0
    if (stressTrackTemp > 45) trackTempLoad = 10 + (stressTrackTemp - 45) * 1.5
    else if (stressTrackTemp > 35) trackTempLoad = (stressTrackTemp - 35) * 1.0

    // 3. Hydration vs. Laps Remaining correlation
    const totalLaps = 78
    const remainingLapsPct = Math.max(0, ((totalLaps - stressLap) / totalLaps) * 100)
    let hydrationLoad = 0
    if (remainingLapsPct > 0 && hydration < remainingLapsPct) {
      // Calculate deficit percentage relative to the remaining laps required
      const deficitRatio = (remainingLapsPct - hydration) / remainingLapsPct
      // Scale deficit more aggressively: 50% deficit = ~39 PSI, 80%+ deficit = ~70+ PSI (guaranteed critical)
      hydrationLoad = Math.pow(deficitRatio, 1.2) * 90
    }

    // 4. Physical G-Force effort
    const gForceLoad = stressGForce * 4.5

    const psi = Math.max(0, Math.min(100, Math.round(tempLoad + trackTempLoad + hydrationLoad + gForceLoad)))
    
    // Derived biometrics
    const hr = Math.round(65 + (psi * 1.25))
    const br = Math.round(12 + (psi * 0.5))
    
    // Stress Level category
    let level = 'CALM'
    if (psi >= 70) {
      level = hydration < 15 ? 'CRITICAL HEALTH RISK' : 'PHYSICAL EXHAUSTION'
    } else if (psi >= 45) {
      level = 'ELEVATED LOAD'
    }
    
    return {
      temp: stressTemp,
      trackTemp: stressTrackTemp,
      gforce: stressGForce,
      lap: stressLap,
      hydration,
      psi,
      hr,
      br,
      level
    }
  }, [stressTemp, stressTrackTemp, stressGForce, stressLap, stressHydrationOverride])

  const buildHistoryTelemetry = useCallback((capture, progressOverride = lapProgress) => {
    const actualLap = replayData?.comparison?.current
    const duration = actualLap?.duration || 90
    return {
      lapNumber: actualLap?.lap_number || null,
      lapProgress: Number(progressOverride.toFixed(4)),
      lapSeconds: Number((progressOverride * duration).toFixed(3)),
      cockpitTemp: stressMetrics.temp,
      trackTemp: stressMetrics.trackTemp,
      gForce: stressMetrics.gforce,
      hydration: stressMetrics.hydration,
      psi: stressMetrics.psi,
      heartRate: stressMetrics.hr,
      breathingRate: stressMetrics.br,
      source: replayData ? 'historical' : 'demo-derived',
      rawPayload: {
        capture,
        recorded_map: {
          circuit_id: replayCircuit,
          circuit_name: replayData?.session?.circuit_short_name || replayCircuit,
          session_key: replayData?.session?.session_key || null,
          map_source: replayData ? 'openf1-replay-reference' : 'local-fallback',
        },
        lap_comparison: replayData?.comparison || null,
      },
    }
  }, [lapProgress, replayCircuit, replayData, stressMetrics])

  const startHistorySession = useCallback(async () => {
    if (!isHistoryConfigured) throw new Error('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env first.')
    if (historySessionRef.current) return historySessionRef.current
    if (historyStartingRef.current) return historyStartingRef.current

    setUploadState('uploading')
    setUploadMessage('CREATING LAP RECORD…')
    const pending = (async () => {
      const token = await historyAccessToken()
      const { session } = await requestHistory('/api/history/start-session', {
        teamId: team.id,
        circuitName: replayData?.session?.circuit_short_name || replayCircuit,
        circuitYear: replayData?.session?.year || 2023,
        driverName: team.drivers?.[0]?.name || 'Demo driver',
        source: replayData ? 'historical-replay' : 'live-demo',
      }, token)
      historySessionRef.current = session.id
      await requestHistory('/api/history/log-telemetry', {
        sessionId: session.id,
        telemetry: buildHistoryTelemetry('lap-start', 0),
      }, token)
      setUploadState('saved')
      setUploadMessage(`LAP RECORD ACTIVE / ${session.id.slice(0, 8).toUpperCase()}`)
      return session.id
    })()

    historyStartingRef.current = pending
    try {
      return await pending
    } catch (error) {
      setUploadState('error')
      setUploadMessage(error.message || 'UPLOAD COULD NOT START')
      throw error
    } finally {
      historyStartingRef.current = null
    }
  }, [buildHistoryTelemetry, replayCircuit, replayData, team])

  const uploadLapSnapshot = useCallback(async (capture = 'manual-upload') => {
    try {
      setUploadState('uploading')
      setUploadMessage('SAVING LAP STATE…')
      const sessionId = await startHistorySession()
      const token = await historyAccessToken()
      await requestHistory('/api/history/log-telemetry', {
        sessionId,
        telemetry: buildHistoryTelemetry(capture),
      }, token)
      setUploadState('saved')
      setUploadMessage(`MAP + TIME SAVED / ${capture.toUpperCase()}`)
    } catch (error) {
      setUploadState('error')
      setUploadMessage(error.message || 'UPLOAD FAILED')
    }
  }, [buildHistoryTelemetry, startHistorySession])

  const finishHistorySession = useCallback(async (status) => {
    const sessionId = historySessionRef.current
    if (!sessionId || historyFinishingRef.current) return
    historyFinishingRef.current = true
    try {
      setUploadState('uploading')
      setUploadMessage(status === 'stopped' ? 'SAVING INCOMPLETE LAP…' : 'SAVING COMPLETED LAP…')
      const token = await historyAccessToken()
      await requestHistory('/api/history/log-telemetry', {
        sessionId,
        telemetry: buildHistoryTelemetry(status === 'stopped' ? 'lap-stopped-incomplete' : 'lap-finished'),
      }, token)
      await requestHistory('/api/history/end-session', { sessionId, status }, token)
      setUploadState('saved')
      setUploadMessage(status === 'stopped' ? 'INCOMPLETE LAP SAVED' : 'COMPLETED LAP SAVED')
    } catch (error) {
      setUploadState('error')
      setUploadMessage(error.message || 'FINAL UPLOAD FAILED')
    } finally {
      historyFinishingRef.current = false
    }
  }, [buildHistoryTelemetry])

  const recordRadioHistory = useCallback(async ({ role, transcript, mood = null, issue = null, confidence = null, trackContext = null, provider = 'pitwall-ai' }) => {
    if (!transcript?.trim() || (lapState !== 'running' && !historySessionRef.current)) return
    try {
      const sessionId = historySessionRef.current || await startHistorySession()
      const token = await historyAccessToken()
      await requestHistory('/api/history/log-event', {
        sessionId,
        role,
        transcript,
        detectedMood: mood,
        moodConfidence: confidence,
        issue,
        classifierConfidence: confidence,
        provider,
        trackContext,
        telemetry: buildHistoryTelemetry(`${role}-radio`),
      }, token)
      setUploadState('saved')
      setUploadMessage(`${role.toUpperCase()} RADIO SAVED`)
    } catch (error) {
      setUploadState('error')
      setUploadMessage(error.message || 'RADIO LOG NOT SAVED')
    }
  }, [buildHistoryTelemetry, lapState, startHistorySession])

  useEffect(() => {
    const updateProgress = () => {
      const section = sequenceRef.current
      if (!section) return
      const rect = section.getBoundingClientRect()
      const distance = section.offsetHeight - window.innerHeight
      const nextProgress = Math.min(1, Math.max(0, -rect.top / distance))
      const lockThreshold = 0.72

      // The intro is a one-way onboarding transition. Once the wheel is locked
      // and its controls become live, scrolling up keeps the user at that exact
      // control position instead of returning to the non-interactive intro.
      if (nextProgress >= lockThreshold && lockedScrollYRef.current === null) {
        const sectionTop = window.scrollY + rect.top
        lockedScrollYRef.current = sectionTop + distance * lockThreshold
      }

      if (lockedScrollYRef.current !== null && window.scrollY < lockedScrollYRef.current) {
        window.scrollTo({ top: lockedScrollYRef.current, behavior: 'auto' })
        setProgress(lockThreshold)
        return
      }

      setProgress(nextProgress)
    }
    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)
    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setReplayLoading(true)
    setReplayError('')
    fetch(apiUrl(`/api/replay?circuit=${replayCircuit}`))
      .then((response) => {
        if (!response.ok) throw new Error('Selected circuit data is unavailable')
        return response.json()
      })
      .then((payload) => { if (!cancelled) setReplayData(payload) })
      .catch((error) => { if (!cancelled) { setReplayData(null); setReplayError(error.message) } })
      .finally(() => { if (!cancelled) setReplayLoading(false) })
    return () => { cancelled = true }
  }, [replayCircuit, replayRequest])

  // Replay is deliberately paced to the historical lap duration. A 1:35.257
  // Bahrain lap therefore takes 95.257 seconds in the interface, rather than
  // using a shortened demo animation.
  useEffect(() => {
    if (lapState !== 'running') return undefined
    const selectedDuration = replayData?.comparison?.current?.duration
    const durationMs = Number.isFinite(selectedDuration) && selectedDuration > 0
      ? selectedDuration * 1000
      : 90_000
    const startedAt = window.performance.now()
    let frame
    const tick = (now) => {
      const nextProgress = Math.min(1, (now - startedAt) / durationMs)
      setLapProgress(nextProgress)
      if (nextProgress < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [lapState, replayData])

  useEffect(() => {
    if (lapProgress >= 1) setLapState('finished')
  }, [lapProgress])

  useEffect(() => {
    if (lapState !== 'finished' || historyFinishingRef.current) return
    void finishHistorySession(lapStoppedEarly ? 'stopped' : 'completed')
  }, [finishHistorySession, lapState, lapStoppedEarly])

  // Auto-hide the 3 panels after 3 seconds when run completes
  useEffect(() => {
    let timeout
    if (lapState === 'finished') {
      timeout = setTimeout(() => {
        setLapState('idle')
      }, 3000)
    }
    return () => clearTimeout(timeout)
  }, [lapState])

  const startLap = () => {
    if (lapState === 'running') return
    // The button remains usable while the historical source reconnects. The
    // run uses the existing on-screen circuit fallback, then upgrades to the
    // selected circuit data whenever the API becomes available.
    if (!replayData) setReplayRequest((request) => request + 1)
    setEngineerMode(false)
    setLapProgress(0)
    setRadioEvents([])
    setDriverTrackContext(null)
    setLapStoppedEarly(false)
    historySessionRef.current = null
    historyFinishingRef.current = false
    setUploadState(isHistoryConfigured ? 'uploading' : 'unavailable')
    setUploadMessage(isHistoryConfigured ? 'OPENING LAP RECORD…' : 'ADD VITE_SUPABASE VALUES TO frontend/.env')
    setLapState('running')
    if (isHistoryConfigured) void startHistorySession()
  }

  const stopLap = () => {
    if (lapState !== 'running') return
    setLapStoppedEarly(true)
    setLapState('finished')
    setEngineerMode(true)
  }

  // ── Engineer hold-to-speak ──
  const handleEngineerDown = useCallback(async () => {
    if (progress < 0.72 || engineerRecorder.recording || driverRecorder.recording) return
    // Manual pit-wall radio is deliberately retained as a later-stage override.
    setAutoEngineerResponse(null)
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

    // Append to full conversation history
    setConversationLog(prev => [...prev, {
      id: `${Date.now()}-engineer`,
      role: 'engineer',
      text: text || engineerTranscript || '',
      mood: 'ENGINEER',
      issue: 'ENGINEER RADIO',
      ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }])

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
      void recordRadioHistory({
        role: 'engineer',
        transcript: text || engineerTranscript || 'Engineer radio received.',
        issue: 'MANUAL ENGINEER RADIO',
        provider: 'manual-override',
      })
      setEngineerProcessing(false)
    }
  }, [engineerRecorder, driverRecorder, team, engineerTranscript, recordRadioHistory])

  // ── Driver hold-to-speak ──
  const handleDriverDown = useCallback(async () => {
    if (progress < 0.72 || driverRecorder.recording || engineerRecorder.recording) return
    onDriverSpeak?.()
    setDriverTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    setDriverConfidence(null)
    setDriverReply('')
    setAutoEngineerResponse(null)
    await driverRecorder.start()
  }, [driverRecorder, engineerRecorder, onDriverSpeak, progress])

  const handleDriverUp = useCallback(async () => {
    if (!driverRecorder.recording) return
    setDriverProcessing(true)
    const result = await driverRecorder.stop()
    if (!result) { setDriverProcessing(false); return }

    const { transcript, audioFeatures, blob, recordingDurationSec } = result
    let text = transcript?.trim()
    
    // ── Speech cadence analysis ──────────────────────────────────────────────────
    // WPM < 70 during a 3s+ recording = slow/laboured speech / taking long pauses
    const wordCount = (text || '').trim().split(/\s+/).filter(Boolean).length
    const wpm = recordingDurationSec > 1 ? Math.round((wordCount / recordingDurationSec) * 60) : 999
    const isSlowSpeech = recordingDurationSec >= 3 && wpm < 70
    const speechCadenceNote = isSlowSpeech
      ? `Slow speech detected (${wpm} WPM / ${recordingDurationSec.toFixed(1)}s recording — taking long pauses)`
      : null
    
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
      const res = await requestRadioAnalysis('/api/analyse/driver', text || driverTranscript || '', team, audioFeatures, {
        circuit: replayCircuit,
        lapProgress,
      })
      let textMood = res.mood || res.state || 'CALM'
      
      // Force text mood to ANGRY if explicit profanity is found, overriding backend
      if (cussCount >= 1) textMood = 'ANGRY'

      // Take the more extreme of the two mood signals
      const moodRank = { CALM: 0, FOCUSED: 0, REVIEW: 1, FRUSTRATED: 2, URGENT: 3, ANGRY: 4 }
      const finalMood = (moodRank[rmsBasedMood] || 0) >= (moodRank[textMood] || 0) ? rmsBasedMood : textMood

      // ── Voice + Telemetry + Speech Cadence — fused stress classification ────────
      // Inputs:
      //   stressMetrics.psi  — composite physical stress index (0–100)
      //   stressMetrics.hydration — current hydration %
      //   isSlowSpeech — true when WPM < 70 across a 3s+ recording
      //   finalMood — text + RMS derived emotion
      let fusedMood = finalMood
      let fusedIssue = res.issue || res.keyword || ''

      const criticalCondition = stressMetrics.psi >= 70 && stressMetrics.hydration < 15
      const exhaustedCondition = stressMetrics.psi >= 70

      if (criticalCondition || (isSlowSpeech && stressMetrics.hydration < 15)) {
        // Worst case: critical dehydration + high PSI or slow speech
        // ONLY update the issue text to flag the health risk. 
        // Mood remains exactly what the audio/text analysis found (e.g. CALM).
        fusedIssue = `CRITICAL HEALTH RISK${speechCadenceNote ? ` — ${speechCadenceNote}` : ''}`
      } else if (exhaustedCondition || isSlowSpeech) {
        // Physical exhaustion OR slow/laboured speech pattern detected
        const reasons = [
          exhaustedCondition && `PSI ${stressMetrics.psi}/100`,
          stressMetrics.hydration <= 30 && `Hydration ${stressMetrics.hydration}%`,
          isSlowSpeech && `${wpm} WPM (slow speech)`,
          stressMetrics.lap > 45 && `Lap ${stressMetrics.lap}/78 (race fatigue)`,
        ].filter(Boolean).join(' · ')
        
        fusedIssue = (finalMood === 'ANGRY' || finalMood === 'FRUSTRATED') 
          ? `${res.issue || 'DRIVER DISTRESS'} — ${reasons}`
          : `PHYSICAL EXHAUSTION — ${reasons}`
      }

      setDriverMood(fusedMood)
      setDriverIssue(fusedIssue)
      setDriverConfidence(res.moodConfidence ?? res.confidence ?? null)
      setDriverReply(res.engineerReply || '')
      setDriverTrackContext(res.trackContext || null)
      setAutoEngineerResponse({
        reply: res.engineerReply || 'Copy. State the car issue and the affected corner.',
        display: res.driverDisplay || res.keyword || 'REPORT ISSUE',
        action: res.recommendedAction || 'State the issue and affected corner.',
      })

      // Append driver + AI thread to conversation log
      const nowTs = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setConversationLog(prev => [...prev,
        {
          id: `${Date.now()}-driver`,
          role: 'driver',
          text: text || driverTranscript || '',
          mood: fusedMood,
          issue: fusedIssue,
          ts: nowTs,
        },
        {
          id: `${Date.now()}-ai`,
          role: 'ai',
          text: res.engineerReply || 'Copy. State the car issue and the affected corner.',
          mood: 'AI',
          issue: res.driverDisplay || 'PITWALL AI',
          ts: nowTs,
        },
      ])

      if (lapState === 'running') {
        const duration = replayData?.comparison?.current?.duration || 90
        const eventProgress = Math.max(0, Math.min(1, lapProgress))
        setRadioEvents((events) => [...events, {
          progress: eventProgress,
          seconds: duration * eventProgress,
          mood: fusedMood,
          issue: fusedIssue || 'RADIO EVENT',
          label: fusedIssue || 'RADIO EVENT',
          detail: `“${text || driverTranscript || 'Driver radio'}”`,
          transcript: text || driverTranscript || '',
          trackContext: res.trackContext || null,
          source: 'LIVE RADIO',
        }].slice(-4))
      }

      void recordRadioHistory({
        role: 'driver',
        transcript: text || driverTranscript || 'Driver radio received.',
        mood: fusedMood,
        issue: fusedIssue,
        confidence: res.moodConfidence ?? res.confidence ?? null,
        trackContext: res.trackContext || null,
        provider: res.provider || 'pitwall-ai',
      })
      void recordRadioHistory({
        role: 'ai',
        transcript: res.engineerReply || 'Copy. State the car issue and the affected corner.',
        issue: res.driverDisplay || res.keyword || 'PITWALL AI',
        trackContext: res.trackContext || null,
        provider: 'pitwall-ai-auto-reply',
      })

      // Driver radio: wheel screen stays silent — only engineer-side messages display on the wheel.
    } catch {
      // Local fallback: combine text analysis + rms
      const local = analyseDriverMessage(text || driverTranscript || '')
      const moodRank = { CALM: 0, FOCUSED: 0, REVIEW: 1, FRUSTRATED: 2, URGENT: 3, ANGRY: 4 }
      const localMoodStr = local.state || 'CALM'
      const finalMood = (moodRank[rmsBasedMood] || 0) >= (moodRank[localMoodStr] || 0) ? rmsBasedMood : localMoodStr
      setDriverMood(finalMood)
      setDriverIssue(local.issue || '')
      setDriverConfidence(local.confidence ?? null)
      const autoResponse = autoEngineerResponseLocal(local.issue, text || driverTranscript || '', finalMood)
      setDriverReply(autoResponse.reply)
      setAutoEngineerResponse(autoResponse)
      setDriverTrackContext(null)
      if (lapState === 'running') {
        const duration = replayData?.comparison?.current?.duration || 90
        const eventProgress = Math.max(0, Math.min(1, lapProgress))
        setRadioEvents((events) => [...events, {
          progress: eventProgress,
          seconds: duration * eventProgress,
          mood: finalMood,
          issue: local.issue || 'RADIO EVENT',
          label: local.issue || 'RADIO EVENT',
          detail: `“${text || driverTranscript || 'Driver radio'}”`,
          transcript: text || driverTranscript || '',
          source: 'LIVE RADIO / LOCAL FALLBACK',
        }].slice(-4))
      }
      // Append fallback driver + AI thread to conversation log
      const nowTs = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setConversationLog(prev => [...prev,
        { id: `${Date.now()}-driver`, role: 'driver', text: text || driverTranscript || '', mood: finalMood, issue: local.issue || '', ts: nowTs },
        { id: `${Date.now()}-ai`, role: 'ai', text: autoResponse.reply || 'Copy.', mood: 'AI', issue: autoResponse.display || 'PITWALL AI', ts: nowTs },
      ])
      void recordRadioHistory({
        role: 'driver',
        transcript: text || driverTranscript || 'Driver radio received.',
        mood: finalMood,
        issue: local.issue || 'RADIO EVENT',
        provider: 'local-fallback',
      })
      void recordRadioHistory({
        role: 'ai',
        transcript: autoResponse.reply || 'Copy.',
        issue: autoResponse.display || 'PITWALL AI',
        provider: 'local-fallback-auto-reply',
      })
    } finally {
      setDriverProcessing(false)
    }
  }, [driverRecorder, engineerRecorder, team, driverTranscript, lapState, lapProgress, replayData, replayCircuit, recordRadioHistory, stressMetrics])

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
      <div className="cockpit-topline">
        <span><i /> TEAM PROFILE LOCKED</span>

        {/* ── Telemetry Condition Selectors ────────────────────────────────── */}
        {!engineerMode && <div className="telemetry-dropdowns" style={{ opacity: panelOpacity, pointerEvents: panelOpacity > 0.5 ? 'auto' : 'none', transition: 'opacity 0.1s ease-out' }}>
          {/* 1 — Remaining Hydration */}
          <label className="telem-picker">
            <span>HYDRATION</span>
            <select
              value={stressHydrationOverride !== null ? stressHydrationOverride : ''}
              onChange={(e) => {
                const v = e.target.value
                setStressHydrationOverride(v === '' ? null : Number(v))
              }}
            >
              <option value="">AUTO</option>
              <option value="5">5%</option>
              <option value="10">10%</option>
              <option value="15">15%</option>
              <option value="20">20%</option>
              <option value="25">25%</option>
              <option value="30">30%</option>
            </select>
            <input
              type="number"
              min="1" max="100" step="1"
              placeholder="—%"
              value={stressHydrationOverride !== null ? stressHydrationOverride : ''}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setStressHydrationOverride(isNaN(v) ? null : Math.min(100, Math.max(1, v)))
              }}
            />
          </label>

          {/* 2 — Cockpit Temperature */}
          <label className="telem-picker">
            <span>COCKPIT TEMP</span>
            <select
              value={stressTemp}
              onChange={(e) => setStressTemp(Number(e.target.value))}
            >
              {[15, 18, 20, 22, 24, 26, 28, 30, 32, 35, 38, 40, 42, 45].map(t => (
                <option key={t} value={t}>{t}°C</option>
              ))}
            </select>
          </label>

          {/* 3 — Track Temperature */}
          <label className="telem-picker">
            <span>TRACK TEMP</span>
            <select
              value={stressTrackTemp}
              onChange={(e) => setStressTrackTemp(Number(e.target.value))}
            >
              {[20, 23, 25, 28, 30, 32, 35, 38, 40, 43, 45, 48, 50, 55].map(t => (
                <option key={t} value={t}>{t}°C</option>
              ))}
            </select>
          </label>

          {/* 4 — Current Lap (second-half focused) */}
          <label className="telem-picker">
            <span>CURRENT LAP</span>
            <select
              value={stressLap}
              onChange={(e) => setStressLap(Number(e.target.value))}
            >
              {[1,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,78].map(l => (
                <option key={l} value={l}>L{l}</option>
              ))}
            </select>
          </label>
        </div>}

        <label className="replay-circuit-picker">REPLAY CIRCUIT <select value={replayCircuit} onChange={(event) => { setReplayCircuit(event.target.value); setLapState('idle'); setLapProgress(0); setEngineerMode(false) }} disabled={lapState === 'running'}><option value="bahrain">BAHRAIN / 2023</option><option value="qatar">QATAR / 2023</option><option value="singapore">SINGAPORE / 2023</option></select></label>
      </div>

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
          lapState={lapState}
          lapReady={!replayLoading && Boolean(replayData)}
          lapAvailabilityLabel={replayError ? 'DATA UNAVAILABLE' : replayLoading ? 'LOADING REAL DATA' : undefined}
          onStartLap={startLap}
          onStopLap={stopLap}
        />
      </div>

      {/* Hood decoration */}
      <div className="cockpit-hood" style={{ opacity: Math.min(1, progress * 1.7) }}><span className="hood-light hood-left" /><span className="hood-light hood-right" /><b>COCKPIT LINK</b></div>

      {lapState !== 'idle' && !engineerMode && <LapRunConsole
        team={team}
        lapState={lapState}
        lapProgress={lapProgress}
        driverTranscript={driverTranscript}
        engineerTranscript={engineerTranscript}
        driverMood={driverMood}
        driverIssue={driverIssue}
        autoEngineerReply={autoEngineerResponse?.reply}
        replayData={replayData}
        onEngineerMode={() => setEngineerMode(true)}
        uploadState={uploadState}
        uploadMessage={uploadMessage}
        onUploadNow={() => void uploadLapSnapshot('manual-upload')}
      />}

      {/* Persistent blue live-signal panel. It becomes readable once the wheel locks. */}
      <div className="sequence-radio" style={{ opacity: lapState === 'idle' ? panelOpacity : 0, pointerEvents: lapState === 'idle' && panelOpacity > .5 ? 'auto' : 'none', transform: `translateX(${(1 - panelOpacity) * 36}px)` }}>
        <LiveRadioCard team={team} onOpen={() => onStart?.()} signalMessage={driverProcessing ? 'TRANSCRIBING / ANALYSING…' : driverTranscript ? `DRIVER: ${driverTranscript}` : ''} mood={driverMood} issue={driverIssue} reply={driverReply} processing={driverProcessing} confidence={driverConfidence} timestamp={driverTimestamp} />
      </div>

      {/* Driver-focused auto reply. Manual engineer radio remains an override. */}
      <div className="cockpit-transcript cockpit-transcript-left" style={{ opacity: lapState === 'idle' ? panelOpacity : 0, pointerEvents: lapState === 'idle' && panelOpacity > .5 ? 'auto' : 'none', transform: `translateX(${(1 - panelOpacity) * -28}px)` }}>
        <div className="ct-label"><span className="ct-dot" /> ENGINEER RADIO / MANUAL OVERRIDE</div>
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
      {engineerMode && <EngineerMode 
        team={team} 
        driverTranscript={driverTranscript} 
        driverIssue={driverIssue} 
        driverMood={driverMood} 
        driverTrackContext={driverTrackContext}
        radioEvents={radioEvents} 
        autoEngineerResponse={autoEngineerResponse} 
        replayData={replayData} 
        replayError={replayError}
        stoppedEarly={lapStoppedEarly} 
        stoppedAt={lapProgress * (replayData?.comparison?.current?.duration || 0)} 
        onClose={() => setEngineerMode(false)} 
        stressMetrics={stressMetrics}
        setStressTemp={setStressTemp}
        setStressTrackTemp={setStressTrackTemp}
        setStressGForce={setStressGForce}
        setStressLap={setStressLap}
        conversationLog={conversationLog}
      />}
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
  if (/front|understeer|front grip/.test(text)) return { state, issue: 'FRONT GRIP', keyword: `FRONT GRIP${turn ? ` ${turn}` : ''}`, confidence: '88%' }
  if (/wheel|tyre|tire/.test(text)) return { state, issue: 'TYRE / WHEEL', keyword: `TYRE CHECK${turn ? ` ${turn}` : ''}`, confidence: '76%' }
  if (/car|balance|handling|unstable/.test(text)) return { state, issue: 'CAR BALANCE', keyword: `BALANCE CHECK${turn ? ` ${turn}` : ''}`, confidence: '66%' }
  if (/hear|radio|mic|microphone|signal|static/.test(text)) return { state: 'URGENT', issue: 'RADIO FAILURE', keyword: 'RADIO FAIL', confidence: '96%' }
  if (/safety car|vsc|yellow/.test(text)) return { state: 'FOCUSED', issue: 'RACE CONTROL', keyword: 'SAFETY CAR', confidence: '97%' }
  if (/box|pit|stop|come in/.test(text)) return { state: 'FOCUSED', issue: 'PIT REQUEST', keyword: 'BOX', confidence: '94%' }
  if (/brake|braking|lock/.test(text)) return { state, issue: 'BRAKING', keyword: `BRAKES${turn ? ` ${turn}` : ''}`, confidence: '85%' }
  if (/engine|power|deploy|ers|mgu|motor/.test(text)) return { state, issue: 'POWER UNIT', keyword: 'ENGINE ISSUE', confidence: '83%' }
  // If cuss words detected but no specific issue, it's an ANGRY/FRUSTRATED unclassified
  if (cussCount >= 1) return { state, issue: 'GENERAL COMPLAINT', keyword: 'DRIVER UNHAPPY', confidence: '70%' }
  return { state, issue: 'UNCLASSIFIED', keyword: 'REVIEW RADIO', confidence: '54%' }
}

// Offline/demo fallback for the same constrained driver-display protocol used by
// the backend. It keeps the interaction usable when the deployed API is asleep.
function autoEngineerResponseLocal(issue, message, mood) {
  const turn = message.match(/turn\s*(\d{1,2})/i)?.[1]
  const atTurn = turn ? ` at T${turn}` : ''
  const displayTurn = turn ? ` T${turn}` : ''
  const responses = {
    'REAR SLIP': { reply: `Copy. Rear slip${atTurn}. Short-shift and reduce exit throttle.`, display: `SHORT SHIFT${displayTurn}`, action: 'Short-shift; smooth the throttle on exit.' },
    'FRONT GRIP': { reply: `Copy. Front grip loss${atTurn}. Avoid the kerb and manage the entry.`, display: `MANAGE ENTRY${displayTurn}`, action: 'Avoid the kerb; protect front grip into the corner.' },
    'TYRE / WHEEL': { reply: `Copy. Tyre or wheel concern${atTurn}. Confirm front or rear, then describe the grip change.`, display: `TYRE CHECK${displayTurn}`, action: 'Confirm whether the issue is at the front or rear before changing setup.' },
    'CAR BALANCE': { reply: `Copy. Balance issue${atTurn}. Confirm whether it is front or rear limited.`, display: `BALANCE CHECK${displayTurn}`, action: 'Confirm the affected axle and corner before a manual engineer response.' },
    'BRAKING': { reply: `Copy. Brake issue${atTurn}. Brake earlier and keep the release smooth.`, display: `BRAKE EARLY${displayTurn}`, action: 'Brake earlier and release progressively.' },
    'RADIO FAILURE': { reply: 'Copy. Radio check. Repeat only the critical car issue.', display: 'RADIO CHECK', action: 'Use short repeat-back messages until signal is clear.' },
    'PIT REQUEST': { reply: 'Copy. Pit request received. We are checking the window; stay on the current plan.', display: 'STAY ON PLAN', action: 'Await manual pit-wall confirmation before changing strategy.' },
    'RACE CONTROL': { reply: 'Copy. Follow the delta and wait for the next call.', display: 'HOLD DELTA', action: 'Follow the delta; await the next pit-wall instruction.' },
  }
  if (responses[issue]) return responses[issue]
  if (mood === 'ANGRY') return { reply: 'Copy. We hear you. Give us the car issue and corner.', display: 'REPORT ISSUE', action: 'State the issue and the affected corner.' }
  return { reply: 'Copy. State the car issue and the affected corner.', display: 'REPORT ISSUE', action: 'State the issue and affected corner.' }
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

async function requestRadioAnalysis(path, message, team, audioFeatures, context = {}) {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, team: team.name, audioFeatures: audioFeatures || undefined, ...context }),
  })
  if (!response.ok) throw new Error('Radio analysis service unavailable')
  return response.json()
}

async function requestHistory(path, body, accessToken) {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Supabase upload failed.')
  return payload
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
          <div className="briefing-actions"><div><button className="primary-action next-action" onClick={() => goTo('cockpit')}>ENTER COCKPIT LINK <ArrowUpRight size={17} /></button></div><span><i /> RADIO DESK READY / TEAM CHANNEL LOCKED</span></div>
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
