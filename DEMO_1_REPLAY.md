# Demo 1 — Lap Replay

## What mentors see

Pitwall Copilot now has a focused replay screen reached from a team's season briefing via **Open Lap Replay**. It has two simple modes:

- **Lap Times:** current lap versus previous lap, sector deltas, the key radio event, and one plain-language reason for the time loss.
- **Engineer View:** synchronised, side-by-side laps with differences in speed, throttle, braking, racing line, and the matched radio note.

## Presentation flow

1. Select a team, then choose **Open Lap Replay**.
2. Choose the circuit, session, driver, and comparison lap.
3. Press **Start Lap** to move both laps through one normalised 0–100% timeline.
4. At the radio marker, play the local radio clip and show the detected issue.
5. Stay in **Lap Times** for the mentor explanation, or switch to **Engineer View** for the supporting signals.
6. Toggle **Dummy Driver Mode** when only a downloaded clip, lap time, and timed events are available.

## Explanation template

> **[Current lap] was [delta] slower than [reference lap]. Most time was lost in [sector/track area] because [visible driving change]. The driver reported [radio issue], which supports [plain-language conclusion].**

Example: *Lap 26 was 0.344s slower than Lap 25. Most time was lost in Sector 2 because braking began earlier and minimum corner speed dropped. The driver reported front-grip loss, which supports the reduced-exit-speed conclusion.*

## Demo data and next data adapter

The current screen intentionally uses prepared two-lap Monaco data for Haas, Audi, and McLaren. It already models two lap objects, a progress-aligned timeline, radio event timestamps, and an audio/event-only fallback. The next backend adapter will replace this prepared data with a pair of lap datasets loaded by circuit, driver, and session.

Suggested response shape:

```json
{
  "currentLap": { "lapTime": "1:31.442", "sectors": ["19.188", "31.670", "40.584"], "signals": [] },
  "referenceLap": { "lapTime": "1:31.098", "sectors": ["19.082", "31.451", "40.565"], "signals": [] },
  "events": [{ "progress": 0.47, "type": "radio", "text": "I have no front grip" }]
}
```

## Fallback states

- **Missing telemetry:** show the available lap time, events, and radio clip in Dummy Driver Mode rather than inventing driving signals.
- **Different lap lengths:** align both laps by normalised 0–100% progress, while retaining the actual lap-time delta separately.
- **Missing audio clip:** retain the transcript and event marker; the replay remains usable without audio playback.
- **Circuit not loaded:** disable replay and state clearly that the prepared dataset is not yet available for that circuit.
