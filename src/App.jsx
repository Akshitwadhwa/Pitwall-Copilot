import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, ChevronRight, CircleDot, Mic, Radio, Send, Sparkles as SparkleIcon, Volume2 } from 'lucide-react'
import haasCar from './assets/haas-f1.jpeg'
import audiCar from './assets/audi-f1.jpg'
import mclarenCar from './assets/mclaren-mcl38.jpg'

const teams = [
  {
    id: 'haas',
    name: 'Haas', code: 'HAA', color: '#d71920', accent: '#f4f4f4',
    image: haasCar,
    position: 'P7', points: '22', podiums: '0', races: '11',
    summary: 'A points-focused campaign where clear, concise feedback is essential for extracting the most from each race weekend.',
    signal: 'Prioritise fast issue classification and reliable driver acknowledgement during high-pressure calls.',
  },
  {
    id: 'audi',
    name: 'Audi', code: 'AUD', color: '#f1192e', accent: '#e7e7e7',
    image: audiCar,
    position: 'P8', points: '12', podiums: '0', races: '11',
    summary: 'The team is collecting points in its first season under the Audi name, with the focus on extracting reliable feedback and making every radio message actionable.',
    signal: 'Prioritise radio quality checks and precise issue reporting from the driver.',
  },
  {
    id: 'mclaren',
    name: 'McLaren', code: 'MCL', color: '#ff8000', accent: '#8cebdd',
    image: mclarenCar,
    position: 'P3', points: '220', podiums: '3', races: '11',
    summary: 'A recovery after an uneven opening stretch. The team benefits from concise strategy confirmation during high-pressure calls.',
    signal: 'Focus the radio desk on clear confirmation when strategy decisions change quickly.',
  },
]

function StepHeader({ step, onBack, title }) {
  return <header className="step-header">
    <button className="wordmark" onClick={onBack}><span><Radio size={16} /></span> PITWALL <em>COPILOT</em></button>
    {title ? <div className="desk-header-title">{title}</div> : <div className="step-track"><b className={step >= 1 ? 'done' : ''}>01 <small>WELCOME</small></b><i /><b className={step >= 2 ? 'done' : ''}>02 <small>TEAM</small></b><i /><b className={step >= 3 ? 'done' : ''}>03 <small>BRIEFING</small></b></div>}
    <div className="header-status"><CircleDot size={12} /> SEASON / 2026</div>
  </header>
}

function LiveRadioCard({ team, onOpen }) {
  const messages = useMemo(() => [
    team ? `${team.name} radio online. The channel is tuned to this team's terminology.` : 'Select a team to tune the radio channel to its terminology.',
    'Pitwall Copilot listens for signal loss, urgency and missed acknowledgement.',
  ], [team])
  const [messageIndex, setMessageIndex] = useState(0)
  const [typedMessage, setTypedMessage] = useState('')

  useEffect(() => {
    const activeMessage = messages[messageIndex]
    if (typedMessage.length < activeMessage.length) {
      const timer = window.setTimeout(() => setTypedMessage(activeMessage.slice(0, typedMessage.length + 1)), 23)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => {
      setTypedMessage('')
      setMessageIndex((current) => (current + 1) % messages.length)
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [messageIndex, messages, typedMessage])

  const openDesk = () => onOpen?.()
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDesk()
    }
  }

  return <aside className="live-radio-card" aria-label="Live team radio example" role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} onClick={openDesk} onKeyDown={handleKeyDown}>
    <div className="radio-card-top"><span>LIVE SIGNAL</span><i /><span>{team?.code || 'CH --'}</span></div>
    <div className="radio-team"><span className="radio-number">{team?.code || '01'}</span><div><strong>{team?.name || 'RADIO'}</strong><b>RADIO</b></div></div>
    <div className="mini-wave" aria-hidden="true">{Array.from({ length: 25 }).map((_, index) => <i key={index} style={{ '--h': `${7 + (index % 6) * 4}px`, '--delay': `${index * -.075}s` }} />)}</div>
    <p>{typedMessage}<span className="typing-cursor">|</span></p>
    <div className="radio-card-footer"><span>COMMUNICATION EVENT</span><span>LISTENING</span></div>
  </aside>
}

function F1Wheel({ team, mode, setMode }) {
  const accent = team.color
  const secondary = team.accent
  const button = (x, y, label, active, handler) => <g className={`wheel-hit ${active ? 'is-active' : ''}`} onClick={handler} role="button" tabIndex="0" aria-label={label}>
    <rect x={x} y={y} width="112" height="42" rx="9" fill={active ? accent : '#10181a'} stroke={active ? accent : '#5d746f'} strokeWidth="2" />
    <text x={x + 56} y={y + 26} fill={active ? '#06100e' : '#d7eee7'} textAnchor="middle" fontSize="12" fontFamily="DM Mono, monospace" letterSpacing="1">{label}</text>
  </g>

  return <svg className="vector-wheel" viewBox="0 0 1000 690" role="img" aria-label={`${team.name} interactive F1 steering wheel`}>
    <defs>
      <linearGradient id="wheelBody" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#202c2d" /><stop offset=".5" stopColor="#0a1012" /><stop offset="1" stopColor="#273432" /></linearGradient>
      <linearGradient id="screenGlow" x1="0" x2="1"><stop stopColor={accent} stopOpacity=".9" /><stop offset="1" stopColor={secondary} stopOpacity=".8" /></linearGradient>
      <filter id="wheelShadow"><feDropShadow dx="0" dy="22" stdDeviation="18" floodColor="#000" floodOpacity=".55" /></filter>
    </defs>
    <ellipse cx="500" cy="625" rx="350" ry="24" fill={accent} opacity=".13" />
    <g filter="url(#wheelShadow)">
      <path d="M118 187 C142 109 238 68 327 110 L394 150 L606 150 L673 110 C762 68 858 109 882 187 L821 231 L792 436 C780 523 704 568 622 539 L554 507 L446 507 L378 539 C296 568 220 523 208 436 L179 231 Z" fill="url(#wheelBody)" stroke="#6f8d85" strokeWidth="5" />
      <path d="M166 207 C193 135 255 112 318 139 L383 176 L617 176 L682 139 C745 112 807 135 834 207 L792 224 L764 405 C753 476 691 506 631 486 L558 457 L442 457 L369 486 C309 506 247 476 236 405 L208 224 Z" fill="#0d1517" stroke="#293b3b" strokeWidth="3" />
      <path d="M176 196 C124 198 93 247 100 326 C106 400 135 463 177 493 L222 459 L207 252 Z" fill="#101819" stroke="#647e77" strokeWidth="5" />
      <path d="M824 196 C876 198 907 247 900 326 C894 400 865 463 823 493 L778 459 L793 252 Z" fill="#101819" stroke="#647e77" strokeWidth="5" />
      <path d="M390 194 L610 194 L655 232 L655 402 L610 438 L390 438 L345 402 L345 232 Z" fill="#091012" stroke="#829a92" strokeWidth="4" />
      <rect x="371" y="220" width="258" height="145" rx="10" fill="#081012" stroke={accent} strokeOpacity=".65" strokeWidth="3" />
      <rect x="389" y="239" width="222" height="10" rx="5" fill="url(#screenGlow)" opacity=".78" />
      <text x="389" y="281" fill="#e8fff7" fontSize="18" fontFamily="DM Mono, monospace" letterSpacing="2">{team.code} / RADIO</text>
      <text x="389" y="309" fill={accent} fontSize="23" fontWeight="700" fontFamily="Space Grotesk, sans-serif">{mode === 'driver' ? 'DRIVER → ENGINEER' : 'ENGINEER → DRIVER'}</text>
      <text x="389" y="338" fill="#7e9b91" fontSize="12" fontFamily="DM Mono, monospace">LIVE TRANSCRIPTION / READY</text>
      {Array.from({ length: 15 }).map((_, index) => <rect key={index} x={389 + index * 14.4} y="256" width="8" height={8 + (index % 4) * 4} rx="3" fill={index % 4 === 0 ? secondary : accent} opacity=".75" />)}
      {Array.from({ length: 12 }).map((_, index) => <circle key={`led-${index}`} cx={401 + index * 18} cy="187" r="5" fill={index < 4 ? accent : index < 8 ? secondary : '#77d8ba'} opacity=".85" />)}
      <circle cx="271" cy="255" r="48" fill="#121d1e" stroke={accent} strokeWidth="4" /><text x="271" y="261" textAnchor="middle" fill={accent} fontSize="22" fontFamily="DM Mono">BRK</text>
      <circle cx="729" cy="255" r="48" fill="#121d1e" stroke={secondary} strokeWidth="4" /><text x="729" y="261" textAnchor="middle" fill={secondary} fontSize="22" fontFamily="DM Mono">THR</text>
      <circle cx="278" cy="379" r="42" fill="#151f20" stroke="#d85d5a" strokeWidth="5" /><text x="278" y="386" textAnchor="middle" fill="#f4aca0" fontSize="17" fontFamily="DM Mono">DIFF</text>
      <circle cx="722" cy="379" r="42" fill="#151f20" stroke="#5fc6aa" strokeWidth="5" /><text x="722" y="386" textAnchor="middle" fill="#a9f5df" fontSize="17" fontFamily="DM Mono">GRP</text>
      <circle cx="500" cy="414" r="27" fill="#111b1c" stroke="#83a79b" strokeWidth="3" /><text x="500" y="420" textAnchor="middle" fill="#dcfff4" fontSize="15" fontFamily="DM Mono">N</text>
      {button(128, 139, 'DRIVER RADIO', mode === 'driver', () => setMode('driver'))}
      {button(760, 139, 'ENGINEER RADIO', mode === 'engineer', () => setMode('engineer'))}
      <text x="184" y="530" fill="#7d9990" fontSize="11" fontFamily="DM Mono" letterSpacing="2">INPUT</text>
      <text x="741" y="530" fill="#7d9990" fontSize="11" fontFamily="DM Mono" letterSpacing="2">OUTPUT</text>
    </g>
  </svg>
}

function CockpitLink({ team, onBack, onStart }) {
  const sequenceRef = useRef()
  const [progress, setProgress] = useState(0)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const [mode, setMode] = useState('driver')

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

  const introOpacity = Math.max(0, 1 - progress * 2.5)
  // Keep the side radio card out of the transition. It should arrive only once
  // the wheel is locked, then remain available as the hand-off into the desk.
  const radioOpacity = Math.max(0, Math.min(1, (progress - .72) * 3.6))
  const wheelStyle = {
    transform: `translate(calc(-50% + ${pointer.x * 12}px), calc(-50% + ${progress * 95 + pointer.y * 6}px)) scale(${1.02 - progress * .14}) rotate(${progress * 1.2 + pointer.x * 1.1}deg)`,
  }
  const moveWheel = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setPointer({ x: (event.clientX - rect.left) / rect.width * 2 - 1, y: (event.clientY - rect.top) / rect.height * 2 - 1 })
  }

  return <section className="cockpit-sequence" ref={sequenceRef}>
    <div className="cockpit-sticky" onPointerMove={moveWheel} onPointerLeave={() => setPointer({ x: 0, y: 0 })}>
      <StepHeader step={3} title={`${team.name.toUpperCase()} / COCKPIT LINK`} onBack={onBack} />
      <div className="cockpit-topline"><span><i /> TEAM PROFILE LOCKED</span><span>SCROLL TO ENGAGE</span></div>
      <div className="sequence-copy" style={{ opacity: introOpacity, transform: `translateY(${-progress * 65}px)` }}>
        <div className="soft-label"><span /> PITWALL INTERFACE</div>
        <h1>Your wheel is<br /><em>the signal.</em></h1>
        <p>{team.name} is linked. Every important message should travel clearly between driver and engineer.</p>
      </div>
      <div className="sequence-wheel" style={wheelStyle}><F1Wheel team={team} mode={mode} setMode={setMode} /></div>
      <div className="cockpit-hood" style={{ opacity: Math.min(1, progress * 1.7) }}><span className="hood-light hood-left" /><span className="hood-light hood-right" /><b>COCKPIT LINK</b></div>
      <div className="sequence-radio" style={{ opacity: radioOpacity, pointerEvents: radioOpacity > .65 ? 'auto' : 'none', transform: `translateX(${(1 - radioOpacity) * 36}px)` }}><LiveRadioCard team={team} onOpen={() => onStart(mode)} /></div>
      <div className="scroll-marker" style={{ opacity: introOpacity }}>SCROLL <span>↓</span></div>
    </div>
  </section>
}

const driverSamples = ['The rear is sliding badly through Turn 2.', 'The front tyres are gone.', "I can't hear you properly.", 'Box this lap.', 'Safety car, safety car.']
const engineerSamples = ['Take less curb at Turn 2.', 'Box this lap.', 'Safety car deployed.', 'Blue flag.']

function extractTurn(message) {
  const number = message.match(/turn\s*(\d{1,2})/i)?.[1]
  return number ? `T${number}` : ''
}

function analyseDriverMessage(message) {
  const text = message.toLowerCase()
  const turn = extractTurn(message)
  if (/rear|slid|throttle|traction/.test(text)) return { state: 'FRUSTRATED', issue: 'REAR SLIP', keyword: `REAR SLIP${turn ? ` ${turn}` : ''}`, confidence: '92%' }
  if (/front|tyre|tire|understeer/.test(text)) return { state: 'ELEVATED', issue: 'FRONT GRIP', keyword: `FRONT GRIP${turn ? ` ${turn}` : ''}`, confidence: '88%' }
  if (/hear|radio|mic|microphone/.test(text)) return { state: 'URGENT', issue: 'RADIO FAILURE', keyword: 'RADIO FAIL', confidence: '96%' }
  if (/safety car/.test(text)) return { state: 'FOCUSED', issue: 'RACE CONTROL', keyword: 'SAFETY CAR', confidence: '97%' }
  if (/box|pit/.test(text)) return { state: 'FOCUSED', issue: 'PIT REQUEST', keyword: 'BOX', confidence: '94%' }
  return { state: 'REVIEW', issue: 'UNCLASSIFIED', keyword: 'REVIEW RADIO', confidence: '54%' }
}

function compressEngineerMessage(message) {
  const text = message.toLowerCase()
  const turn = extractTurn(message)
  if (/less curb/.test(text)) return `LESS CURB${turn ? ` ${turn}` : ''}`
  if (/safety car/.test(text)) return 'SAFETY CAR'
  if (/blue flag/.test(text)) return 'BLUE FLAG'
  if (/box|pit/.test(text)) return 'BOX THIS LAP'
  return 'CHECK RADIO'
}

function confidenceLabel(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return value || '—'
  return `${Math.round(numeric <= 1 ? numeric * 100 : numeric)}%`
}

async function requestRadioAnalysis(path, message, team) {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, team: team.name }) })
  if (!response.ok) throw new Error('Radio analysis service unavailable')
  return response.json()
}

function RadioDesk({ team, onBack }) {
  const [driverMessage, setDriverMessage] = useState(driverSamples[0])
  const [engineerMessage, setEngineerMessage] = useState(engineerSamples[0])
  const [driverAnalysis, setDriverAnalysis] = useState(() => analyseDriverMessage(driverSamples[0]))
  const [driverDisplay, setDriverDisplay] = useState(() => compressEngineerMessage(engineerSamples[0]))
  const [driverProvider, setDriverProvider] = useState('local demo rules')
  const [engineerProvider, setEngineerProvider] = useState('local demo rules')
  const [analysingDriver, setAnalysingDriver] = useState(false)
  const [analysingEngineer, setAnalysingEngineer] = useState(false)

  const sendDriverMessage = async () => {
    setAnalysingDriver(true)
    try {
      const result = await requestRadioAnalysis('/api/analyse/driver', driverMessage, team)
      setDriverAnalysis(result)
      setDriverProvider(result.provider || 'radio analysis service')
    } catch {
      setDriverAnalysis(analyseDriverMessage(driverMessage))
      setDriverProvider('local demo fallback')
    } finally {
      setAnalysingDriver(false)
    }
  }

  const sendEngineerMessage = async () => {
    setAnalysingEngineer(true)
    try {
      const result = await requestRadioAnalysis('/api/analyse/engineer', engineerMessage, team)
      setDriverDisplay(result.keyword || compressEngineerMessage(engineerMessage))
      setEngineerProvider(result.provider || 'radio analysis service')
    } catch {
      setDriverDisplay(compressEngineerMessage(engineerMessage))
      setEngineerProvider('local demo fallback')
    } finally {
      setAnalysingEngineer(false)
    }
  }

  return <section className="radio-desk-page">
    <StepHeader step={3} title={`${team.name.toUpperCase()} / RADIO DESK`} onBack={onBack} />
    <div className="desk-wrap">
      <div className="desk-intro"><button className="back-link" onClick={onBack}><ArrowLeft size={15} /> BACK TO COCKPIT LINK</button><div className="soft-label"><span /> COMMUNICATION LOOP</div><h1>Say it.<br /><em>Understand it.</em></h1><p>Choose a known radio call or type your own message. The API retrieves F1 examples first, then sends uncertain messages to the Hugging Face classifier.</p></div>
      <div className="radio-flow">
        <section className="message-panel"><div className="panel-title"><Mic size={15} /> DRIVER RADIO <span>01</span></div><select value={driverMessage} onChange={(event) => setDriverMessage(event.target.value)}><option value="">Select a demonstration message</option>{driverSamples.map((sample) => <option key={sample} value={sample}>{sample}</option>)}</select><textarea value={driverMessage} onChange={(event) => setDriverMessage(event.target.value)} aria-label="Driver radio message" /><button className="send-button" onClick={sendDriverMessage} disabled={analysingDriver}>{analysingDriver ? 'ANALYSING…' : 'SEND TO ENGINEER'} <Send size={14} /></button></section>
        <section className="engineer-view"><span className="ai-label">AI INTERPRETATION</span><div><span>DRIVER STATE</span><b>{driverAnalysis.state}</b></div><div><span>ISSUE</span><b>{driverAnalysis.issue}</b></div><div><span>KEYWORD</span><strong>{driverAnalysis.keyword}</strong></div><p>“{driverMessage}”</p><small>CONFIDENCE {confidenceLabel(driverAnalysis.confidence)} / {driverProvider}</small></section>
        <section className="message-panel"><div className="panel-title"><Volume2 size={15} /> ENGINEER RADIO <span>02</span></div><select value={engineerMessage} onChange={(event) => setEngineerMessage(event.target.value)}><option value="">Select a demonstration message</option>{engineerSamples.map((sample) => <option key={sample} value={sample}>{sample}</option>)}</select><textarea value={engineerMessage} onChange={(event) => setEngineerMessage(event.target.value)} aria-label="Engineer radio message" /><button className="send-button" onClick={sendEngineerMessage} disabled={analysingEngineer}>{analysingEngineer ? 'COMPRESSING…' : 'SEND TO DRIVER'} <Send size={14} /></button></section>
        <section className="driver-display"><span>DRIVER DISPLAY / APPROVED MESSAGE</span><b>{driverDisplay}</b><small>WHITE COMMUNICATION MODE / {engineerProvider}</small></section>
      </div>
    </div>
  </section>
}

function App() {
  const [page, setPage] = useState('welcome')
  const [activeTeam, setActiveTeam] = useState(null)
  const selected = teams.find((team) => team.id === activeTeam)
  const goTo = (nextPage) => { window.scrollTo({ top: 0, behavior: 'auto' }); setPage(nextPage) }
  const selectTeam = (team) => { setActiveTeam(team.id); goTo('cockpit') }

  return <main className={`app-shell page-${page}`} style={{ '--team': selected?.color || '#bffff0', '--accent': selected?.accent || '#ff8000' }}>
    <div className="film-grain" />
    {page === 'welcome' && <section className="welcome-page">
      <StepHeader step={1} onBack={() => setPage('welcome')} />
      <div className="welcome-copy">
        <div className="soft-label"><span /> F1 COMMUNICATION INTELLIGENCE</div>
        <h1>Welcome to<br /><em>the pit wall.</em></h1>
        <p>Welcome to your quiet teammate on the pit wall. Before the noise starts, let’s set up your race context.</p>
        <button className="primary-action" onClick={() => goTo('teams')}>CHOOSE YOUR TEAM <ArrowUpRight size={17} /></button>
      </div>
      <div className="welcome-footer"><span><i /> SECURE RACE SESSION</span><span>THE SILENT CO-DRIVER / 01</span></div>
    </section>}

    {page === 'teams' && <section className="teams-page">
      <StepHeader step={2} onBack={() => setPage('welcome')} />
      <div className="selection-intro"><div className="soft-label"><span /> RACE CONTEXT</div><h1>Choose your<br /><em>team.</em></h1><p>We’ll load a focused season briefing before opening the radio desk.</p></div>
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
      <StepHeader step={3} onBack={() => setPage('teams')} />
      <div className="briefing-wrap">
        <div className="briefing-title"><button className="back-link" onClick={() => setPage('teams')}><ArrowLeft size={15} /> CHANGE TEAM</button><div className="soft-label"><span /> TEAM BRIEFING / 2026</div><h1>{selected.name}<br /><em>season.</em></h1></div>
        <div className="team-portrait"><img src={selected.image} alt="" /><span /><div><b>{selected.code}</b><small>TEAM PROFILE LOADED</small></div></div>
        <article className="briefing-data">
          <p className="briefing-summary">{selected.summary}</p>
          <div className="stat-grid"><div><span>CHAMPIONSHIP</span><b>{selected.position}</b></div><div><span>POINTS</span><b>{selected.points}</b></div><div><span>GP PODIUMS</span><b>{selected.podiums}</b></div><div><span>ROUNDS</span><b>{selected.races}</b></div></div>
          <div className="copilot-note"><SparkleIcon size={17} /><div><span>COPILOT FOCUS</span><p>{selected.signal}</p></div></div>
          <div className="source-line">SEASON SNAPSHOT: FORMULA1.COM RESULTS / CHECKED 10 AUG 2026</div>
          <button className="primary-action next-action" onClick={() => setPage('radio')}>CONTINUE TO RADIO DESK <Mic size={17} /></button>
        </article>
      </div>
      <div className="briefing-footer">DATA SHOULD INFORM THE DRIVER. NEVER DISTRACT THEM.</div>
    </section>}

    {page === 'cockpit' && selected && <CockpitLink team={selected} onBack={() => goTo('teams')} onStart={() => goTo('radio')} />}

    {page === 'radio' && selected && <RadioDesk team={selected} onBack={() => goTo('cockpit')} />}
  </main>
}

export default App
