# Duck Narrator — Design

**Date:** 2026-07-12
**Status:** Approved

## Purpose

Add a text-to-speech "duck narrator" to the quiz site: a button on each question
card reads the question stem aloud in a Donald Duck-style voice. Answer options
are never read. Pure fun feature; must not slow down or destabilize the quiz.

## Decisions (from brainstorming)

- **Voice tech:** true "Donald Duck effect" DSP, not just pitched-up system TTS.
  User explicitly wants a real duck voice.
- **Trigger:** speaker button only (🦆 on the question card). No autoplay, no
  settings toggle — the button is the opt-in.

## Architecture

### Synthesis (vendored, offline)

- Vendor a WASM/JS eSpeak build (meSpeak or espeak-ng emscripten build) into
  `site/vendor/`. Committed to the repo so GitHub Pages serves it — no CDN, no
  API key, no network dependency beyond the site's own origin.
- Lazy-loaded on the first 🦆 click so initial page load is unaffected.
- Synthesizes the question stem to a raw PCM buffer (not played directly).

### Duck-ification DSP

Processing applied to the synthesized buffer before playback:

1. **Frequency shift** (the core effect): FFT → analytic signal → multiply by
   a complex exponential → real part. Shifts every harmonic up by a fixed
   ~250–400 Hz, destroying the harmonic series the same way helium speech /
   mistuned SSB radio does — the literal, textbook "Donald Duck effect".
2. **Mild waveshaping distortion** for Donald's pharyngeal buzz.
3. Output through Web Audio (`AudioContext`), created/resumed inside the click
   handler to satisfy autoplay policies.

### Components

| Unit | Responsibility |
|---|---|
| `site/js/voice.js` (new) | Lazy-load synth, `speak(text)` / `stop()`, DSP chain, small radix-2 FFT. Exposes load-failure state. |
| `site/js/components/questionCard.js` | Render 🦆 button next to the stem; toggle speak/stop; call `stop()` when the question is answered or the card is torn down. |
| `site/vendor/` (new) | Committed synth engine + voice data (~1–2 MB). |

### Behavior

- Click 🦆 → synthesize + play the stem in duck voice.
- Click again while playing → stop.
- Answering, timing out, or navigating to the next question → stop.
- Works identically in streak and exam screens (both render via `questionCard`).

## Error handling

If the synth fails to load or synthesize (offline first visit, old browser):
the button shows a brief failed state ("can't quack"), then disables for the
session. The quiz itself is never blocked.

## Testing

Manual verification:

- Streak mode and exam mode: button appears, reads stem only, sounds duck-like.
- Stop-on-answer, stop-on-timeout, stop-on-navigation, toggle stop.
- Deployed GitHub Pages build: vendor files resolve via relative paths.
- Failure path: block `site/vendor/*` in devtools → button disables gracefully.
