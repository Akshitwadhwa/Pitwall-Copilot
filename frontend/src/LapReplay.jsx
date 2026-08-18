import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, Gauge, Headphones, Pause, Play, RotateCcw, SlidersHorizontal, Timer, Volume2 } from 'lucide-react'

const replayByTeam = {
  mclaren: {
    circuit: 'MONACO', session: '2024 RACE', lap: 26, previousLap: 25,
    currentTime: '1:30.316', previousTime: '1:29.842', delta: '+0.474',
    currentSectors: ['18.952', '31.248', '40.116'], previousSectors: ['18.861', '30.978', '40.003'],
    driverReport: 'The rear is moving on throttle.', driverDisplay: 'REAR SLIP',
    explanation: 'Sector 2 was 0.27s slower. Earlier throttle on exit was not possible after the rear became unstable.',
  },
  haas: {
    circuit: 'MONACO', session: '2024 RACE', lap: 26, previousLap: 25,
    currentTime: '1:31.442', previousTime: '1:31.098', delta: '+0.344',
    currentSectors: ['19.188', '31.670', '40.584'], previousSectors: ['19.082', '31.451', '40.565'],
    driverReport: 'I have no front grip through the slow corners.', driverDisplay: 'FRONT GRIP',
    explanation: 'The lap lost time mainly in Sector 2, where braking began earlier and minimum corner speed dropped.',
  },
  audi: {
    circuit: 'MONACO', session: '2024 RACE', lap: 26, previousLap: 25,
    currentTime: '1:31.216', previousTime: '1:30.928', delta: '+0.288',
    currentSectors: ['19.010', '31.486', '40.720'], previousSectors: ['18.921', '31.334', '40.673'],
    driverReport: 'The tyres are dropping away in Sector 2.', driverDisplay: 'TYRE DROP',
    explanation: 'Sector 2 lost 0.15s as tyre grip reduced. The driver carried less speed through the second slow-speed sequence.',
  },
}

const telemetryDifferences = [
  { signal: 'SPEED', previous: '+4.8 km/h', current: 'slower on exit', type: 'loss' },
  { signal: 'THROTTLE', previous: 'EARLIER', current: '−14% at exit', type: 'loss' },
  { signal: 'BRAKING', previous: 'LATER', current: '+7 m earlier', type: 'loss' },
  { signal: 'RACING LINE', previous: 'NORMAL', current: 'wider exit', type: 'loss' },
]

function secondsFromLapTime(value) {
  const [minutes, seconds] = value.split(':').map(Number)
  return minutes * 60 + seconds
}

function sectorDelta(current, previous) {
  return `+${(Number(current) - Number(previous)).toFixed(3)}`
}

function ReplayTimeline({ replay, progress, activeEvent }) {
  const events = [
    { at: 0.16, label: 'T1 BRAKE', note: 'Early brake point' },
    { at: 0.47, label: 'T4 RADIO', note: replay.driverReport },
    { at: 0.7, label: 'T8 EXIT', note: 'Throttle hesitation' },
    { at: 0.92, label: 'FINISH', note: `DELTA ${replay.delta}s` },
  ]

  return <div className="replay-timeline" aria-label="Lap replay timeline">
    <div className="timeline-track"><i style={{ width: `${progress * 100}%` }} /></div>
    {events.map((event) => <button
      key={event.label}
      className={`timeline-event ${activeEvent === event.label ? 'is-active' : ''}`}
      style={{ left: `${event.at * 100}%` }}
      title={event.note}
      type="button"
    ><span>{event.label}</span></button>)}
    <div className="timeline-times"><span>00:00</span><span>00:30</span><span>01:00</span><span>FINISH</span></div>
  </div>
}

function LapReplay({ team, onBack, onPlayRadio }) {
  const [view, setView] = useState('lap-times')
  const [selectedCircuit, setSelectedCircuit] = useState('MONACO')
  const [selectedDriver, setSelectedDriver] = useState(team.drivers?.[0]?.name || 'Driver')
  const [dummyMode, setDummyMode] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [radioPlayed, setRadioPlayed] = useState(false)

  const replay = replayByTeam[team.id] || replayByTeam.mclaren
  const currentSeconds = secondsFromLapTime(replay.currentTime)
  const previousSeconds = secondsFromLapTime(replay.previousTime)
  const activeEvent = progress >= 0.47 && progress < 0.7 ? 'T4 RADIO' : progress >= 0.7 && progress < 0.92 ? 'T8 EXIT' : progress >= 0.92 ? 'FINISH' : progress >= 0.16 ? 'T1 BRAKE' : ''
  const circuitReady = selectedCircuit === 'MONACO'

  useEffect(() => {
    if (!isPlaying || progress >= 1) return undefined
    const timer = window.setInterval(() => setProgress((value) => Math.min(1, value + 0.006)), 100)
    return () => window.clearInterval(timer)
  }, [isPlaying, progress])

  useEffect(() => {
    if (progress >= 0.47 && progress < 0.5 && !radioPlayed) {
      onPlayRadio?.()
      setRadioPlayed(true)
    }
  }, [progress, radioPlayed, onPlayRadio])

  useEffect(() => {
    if (progress >= 1) setIsPlaying(false)
  }, [progress])

  const playReplay = () => {
    if (!circuitReady) return
    if (progress >= 1) { setProgress(0); setRadioPlayed(false) }
    setIsPlaying((value) => !value)
  }

  const resetReplay = () => {
    setIsPlaying(false)
    setProgress(0)
    setRadioPlayed(false)
  }

  const summary = useMemo(() => ({
    current: replay.currentTime,
    previous: replay.previousTime,
    delta: replay.delta,
    sectorLoss: sectorDelta(replay.currentSectors[1], replay.previousSectors[1]),
  }), [replay])

  return <section className="replay-page">
    <header className="replay-header">
      <button className="wordmark" onClick={onBack}><span><ArrowLeft size={16} /></span> PITWALL <em>COPILOT</em></button>
      <div><b>REPLAY INTELLIGENCE</b><small>LAP COMPARISON / DEMO 01</small></div>
      <span><i /> SESSION READY</span>
    </header>

    <main className="replay-wrap">
      <section className="replay-intro">
        <div>
          <span className="replay-kicker">SILENT CO-DRIVER / LAP REPLAY</span>
          <h1>Why did this<br /><em>lap change?</em></h1>
          <p>Compare the current lap with the previous lap, then replay the radio and engineering context at the moment pace changed.</p>
        </div>
        <button className="back-link" onClick={onBack}><ArrowLeft size={14} /> BACK TO TEAM BRIEFING</button>
      </section>

      <section className="replay-controls" aria-label="Lap replay controls">
        <label>CIRCUIT<select value={selectedCircuit} onChange={(event) => { setSelectedCircuit(event.target.value); resetReplay() }}><option>MONACO</option><option>SUZUKA</option><option>BAHRAIN</option></select></label>
        <label>SESSION<select defaultValue={replay.session}><option>{replay.session}</option></select></label>
        <label>DRIVER<select value={selectedDriver} onChange={(event) => { setSelectedDriver(event.target.value); resetReplay() }}>{team.drivers?.map((driver) => <option key={driver.number}>{driver.name}</option>)}</select></label>
        <label>COMPARE<select defaultValue="previous"><option value="previous">LAP {replay.previousLap} / PREVIOUS</option><option>3-LAP AVERAGE</option><option>DRIVER BEST LAP</option></select></label>
        <button className={`dummy-switch ${dummyMode ? 'is-active' : ''}`} onClick={() => { setDummyMode((value) => !value); resetReplay() }} type="button"><Headphones size={14} /> {dummyMode ? 'DUMMY DRIVER ON' : 'DUMMY DRIVER MODE'}</button>
        <button className="replay-play" onClick={playReplay} type="button" disabled={!circuitReady}>{isPlaying ? <><Pause size={15} /> PAUSE</> : <><Play size={15} /> START LAP {replay.lap}</>}</button>
      </section>

      {!circuitReady && <div className="replay-state"><b>NO TELEMETRY LOADED</b><span>This demo currently contains a prepared Monaco replay. Select Monaco to continue.</span></div>}

      <section className="replay-mode-tabs" aria-label="Replay view mode">
        <button className={view === 'lap-times' ? 'is-active' : ''} onClick={() => setView('lap-times')}><Timer size={15} /> LAP TIMES</button>
        <button className={view === 'engineer' ? 'is-active' : ''} onClick={() => setView('engineer')}><SlidersHorizontal size={15} /> ENGINEER VIEW</button>
      </section>

      <section className="replay-hero">
        <div className="replay-lap-title"><span>{team.code} / {selectedDriver.toUpperCase()}</span><strong>LAP {replay.lap}</strong><small>vs LAP {replay.previousLap}</small></div>
        <div className="replay-timer"><b>{(currentSeconds * progress).toFixed(1).padStart(4, '0')}<small> / {replay.currentTime}</small></b><span>REPLAY CLOCK</span></div>
        <div className="replay-delta"><span>LAP DELTA</span><b>{summary.delta}s</b><small>LOSS TO PREVIOUS LAP</small></div>
        <button className="replay-reset" onClick={resetReplay} type="button" aria-label="Reset replay"><RotateCcw size={15} /></button>
      </section>

      <ReplayTimeline replay={replay} progress={progress} activeEvent={activeEvent} />

      {view === 'lap-times' ? <section className="lap-times-view">
        <article className="lap-summary-card current"><span>CURRENT / LAP {replay.lap}</span><b>{summary.current}</b><small>{summary.delta}s TO LAP {replay.previousLap}</small></article>
        <article className="lap-summary-card"><span>PREVIOUS / LAP {replay.previousLap}</span><b>{summary.previous}</b><small>REFERENCE LAP</small></article>
        <article className="lap-summary-card event"><span>KEY EVENT / T4</span><b>{replay.driverDisplay}</b><small>{activeEvent === 'T4 RADIO' ? 'RADIO ACTIVE' : 'DRIVER RADIO DETECTED'}</small></article>

        <article className="sector-card"><div className="section-title"><Gauge size={15} /> SECTOR COMPARISON <small>CURRENT vs PREVIOUS</small></div>{['S1', 'S2', 'S3'].map((sector, index) => <div className={`sector-row ${index === 1 ? 'is-loss' : ''}`} key={sector}><span>{sector}</span><b>{replay.currentSectors[index]}</b><em>{sectorDelta(replay.currentSectors[index], replay.previousSectors[index])}</em><small>PREV {replay.previousSectors[index]}</small></div>)}</article>

        <article className="why-card"><span>WHY THE LAP CHANGED</span><h2>{replay.explanation}</h2><div><i /> <b>Evidence:</b> {summary.sectorLoss}s in Sector 2, radio report at T4, reduced exit commitment.</div></article>

        <article className="radio-event-card"><div><span>{activeEvent === 'T4 RADIO' ? 'LIVE RADIO / PLAYING' : 'RADIO EVENT / 00:28'}</span><b>“{replay.driverReport}”</b><small>AI ISSUE: {replay.driverDisplay} / DRIVER STATE: FRUSTRATED</small></div><button onClick={() => { onPlayRadio?.(); setRadioPlayed(true) }} type="button"><Volume2 size={15} /> PLAY CLIP</button></article>
      </section> : <section className="engineer-view-replay">
        <article className="lap-side previous"><span>REFERENCE LAP {replay.previousLap}</span><b>{replay.previousTime}</b><div className="lap-bar"><i style={{ width: '78%' }} /></div><small>STABLE EXIT / NORMAL BRAKE POINT</small></article>
        <article className="lap-side current"><span>CURRENT LAP {replay.lap}</span><b>{replay.currentTime}</b><div className="lap-bar"><i style={{ width: '94%' }} /></div><small>RADIO EVENT / {replay.driverDisplay}</small></article>

        {!dummyMode && <article className="difference-card"><div className="section-title"><SlidersHorizontal size={15} /> HIGHLIGHTED DIFFERENCES <small>ALIGNED BY LAP PROGRESS</small></div>{telemetryDifferences.map((item) => <div className="difference-row" key={item.signal}><span>{item.signal}</span><b>{item.previous}</b><em>{item.current}</em><i className={item.type} /></div>)}</article>}

        {dummyMode && <article className="dummy-card"><Headphones size={19} /><div><span>DUMMY DRIVER MODE</span><b>Audio and event replay is active without full telemetry.</b><p>Use this mode when only lap time, event timing, and downloaded radio clips are available.</p></div></article>}

        <article className="engineer-explanation"><span>ENGINEER SUMMARY</span><h2>“{replay.driverReport}”</h2><p>{replay.explanation}</p><div><b>Suggested response</b><strong>COPY. {replay.driverDisplay}. MANAGE EXIT.</strong></div></article>
      </section>}

      <footer className="replay-footer"><span><i /> LAP ALIGNMENT: NORMALISED TO 0–100% PROGRESS</span><span>{dummyMode ? 'AUDIO + EVENT REPLAY / NO FULL TELEMETRY' : 'TELEMETRY DEMO / PREPARED REPLAY DATA'}</span></footer>
    </main>
  </section>
}

export default LapReplay
