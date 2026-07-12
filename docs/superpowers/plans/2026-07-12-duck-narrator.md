# Duck Narrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 🦆 button on every question card reads the question stem aloud in a Donald Duck-style voice, fully offline via a vendored speech synthesizer.

**Architecture:** A one-time esbuild bundle of npm `mespeak@2.0.2` (emscripten eSpeak + config + en-US voice) is committed as `site/vendor/mespeak.js` and lazy-loaded on first click. Pure DSP (`site/js/duckdsp.js`, node-testable) applies the textbook "Donald Duck effect": waveshaping buzz, then an FFT analytic-signal frequency shift that moves every harmonic up ~320 Hz. Browser glue (`site/js/voice.js`) synthesizes → duckifies → plays via Web Audio; a shared `duckButton` component is wired into the streak question card and the exam screen's inline card.

**Tech Stack:** Vanilla ES modules, Web Audio API, node:test for DSP unit tests, esbuild (build-time only, via npx).

**Spec:** `docs/superpowers/specs/2026-07-12-duck-narrator-design.md`

## Global Constraints

- Zero runtime dependencies; the site must keep working from `python3 -m http.server -d site 8000` and GitHub Pages (workflow uploads the `site/` dir verbatim).
- Vendor bundle is committed (~1.9 MB) and lazy-loaded — initial page load must not fetch it.
- Only the question **stem** is read, never the options.
- No autoplay, no settings toggle — the 🦆 button is the only trigger.
- On synth load/synthesis failure: button disables for the session ("can't quack"); quiz flow never blocked.
- Respect reduced motion: no button animation when `html[data-reduced-motion]` is set.
- Follow repo idiom: `el()` helper from `site/js/components/dom.js`, small focused modules, comments only for non-obvious constraints.

---

### Task 1: Vendor the meSpeak bundle

**Files:**
- Create: `tools/vendor-mespeak.sh`
- Create: `tools/check-mespeak.mjs`
- Create: `site/vendor/mespeak.js` (generated, committed)
- Create: `site/vendor/README.md`

**Interfaces:**
- Produces: classic script `site/vendor/mespeak.js` that defines global `meSpeak` with `meSpeak.speak(text, opts)` — `opts.rawdata: 'array'` returns WAV bytes as a plain number array synchronously; `opts` also accepts `pitch` (0–99), `speed` (wpm), `amplitude` (0–200). Config and en-US voice are baked in; no further loading needed.

- [ ] **Step 1: Write the failing check script**

```js
// tools/check-mespeak.mjs
// Smoke-checks the vendored meSpeak bundle: evaluates it the way a browser
// would (classic script scope) and asserts it synthesizes a RIFF/WAV buffer.
// Usage: node tools/check-mespeak.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const url = new URL('../site/vendor/mespeak.js', import.meta.url);
const code = readFileSync(url, 'utf8');
// The bundle is an IIFE assigning `var meSpeak`; function scope emulates a
// classic <script>. require/__dirname provided in case emscripten probes node.
const require = createRequire(import.meta.url);
const meSpeak = new Function('require', '__dirname', '__filename', `${code}; return meSpeak;`)(
  require, process.cwd(), 'mespeak.js',
);
const wav = meSpeak.speak('quack quack', { rawdata: 'array' });
const riff = wav && String.fromCharCode(...wav.slice(0, 4)) === 'RIFF';
if (!riff || wav.length < 1000) {
  console.error('FAIL: bundle did not synthesize a WAV', wav && wav.length);
  process.exit(1);
}
console.log(`OK: synthesized ${wav.length} WAV bytes`);
```

- [ ] **Step 2: Run it to verify it fails (no bundle yet)**

Run: `node tools/check-mespeak.mjs`
Expected: FAIL — `ENOENT ... site/vendor/mespeak.js`

- [ ] **Step 3: Write the build script**

```bash
#!/usr/bin/env bash
# Rebuilds site/vendor/mespeak.js from npm mespeak@2.0.2:
# engine (emscripten eSpeak) + mespeak_config.json + en-US voice, one minified
# IIFE exposing global `meSpeak`. Needs node/npm. Run from anywhere.
set -euo pipefail
OUT="$(cd "$(dirname "$0")/.." && pwd)/site/vendor/mespeak.js"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
npm pack mespeak@2.0.2 --silent
tar xzf mespeak-2.0.2.tgz
cat > entry.js <<'EOF'
const meSpeak = require('./package/src/index.js');
meSpeak.loadConfig(require('./package/src/mespeak_config.json'));
meSpeak.loadVoice(require('./package/voices/en/en-us.json'));
module.exports = meSpeak;
EOF
npx --yes esbuild entry.js --bundle --minify --format=iife --global-name=meSpeak --outfile="$OUT"
echo "wrote $OUT"
```

Save as `tools/vendor-mespeak.sh`, then: `chmod +x tools/vendor-mespeak.sh`

- [ ] **Step 4: Build the bundle and verify the check passes**

Run: `mkdir -p site/vendor && ./tools/vendor-mespeak.sh && node tools/check-mespeak.mjs`
Expected: `wrote .../site/vendor/mespeak.js` then `OK: synthesized <n> WAV bytes` (n ≈ 100k). Bundle ≈ 1.9 MB.

- [ ] **Step 5: Write the provenance README**

```markdown
# site/vendor

## mespeak.js (~1.9 MB)

meSpeak 2.0.2 (https://www.npmjs.com/package/mespeak) — an emscripten build of
eSpeak — bundled into a single IIFE with its config and the en-US voice baked
in. Exposes global `meSpeak`. Rebuild with `tools/vendor-mespeak.sh`; smoke
test with `node tools/check-mespeak.mjs`.

License: GPLv3 (eSpeak / meSpeak). Source for the exact build inputs is the
npm tarball pinned above.
```

- [ ] **Step 6: Commit**

```bash
git add tools/vendor-mespeak.sh tools/check-mespeak.mjs site/vendor/mespeak.js site/vendor/README.md
git commit -m "Vendor meSpeak speech engine as a single offline bundle"
```

---

### Task 2: Pure DSP module (`duckdsp.js`) — TDD

**Files:**
- Create: `package.json` (repo root)
- Create: `tests/duckdsp.test.js`
- Create: `site/js/duckdsp.js`

**Interfaces:**
- Produces (all exported from `site/js/duckdsp.js`):
  - `fft(re: Float64Array, im: Float64Array, inverse?: boolean): void` — in-place radix-2 FFT, length must be a power of 2.
  - `wavToFloat32(bytes: Uint8Array): { samples: Float32Array, sampleRate: number }` — parses 16-bit PCM WAV (mono or first channel), throws `Error` on non-WAV/unsupported input.
  - `frequencyShift(samples: Float32Array, sampleRate: number, shiftHz: number): Float32Array` — analytic-signal frequency shift, output same length as input.
  - `duckify(samples: Float32Array, sampleRate: number, opts?: { shiftHz?: number, drive?: number }): Float32Array` — waveshape (default drive 2.2) then shift (default 320 Hz), peak-normalized to 0.9.

- [ ] **Step 1: Create root package.json so node treats `.js` as ESM and can run tests**

```json
{
  "name": "llm-exam-prep",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Write the failing tests**

```js
// tests/duckdsp.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { fft, frequencyShift, duckify, wavToFloat32 } from '../site/js/duckdsp.js';

function dominantHz(samples, sampleRate) {
  let N = 1;
  while (N < samples.length) N <<= 1;
  const re = new Float64Array(N), im = new Float64Array(N);
  re.set(samples);
  fft(re, im);
  let best = 1, bestMag = 0;
  for (let k = 1; k < N / 2; k++) {
    const m = re[k] ** 2 + im[k] ** 2;
    if (m > bestMag) { bestMag = m; best = k; }
  }
  return (best * sampleRate) / N;
}

function makeWav(samples, sampleRate) {
  const n = samples.length;
  const dv = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.round(samples[i] * 32767), true);
  return new Uint8Array(dv.buffer);
}

test('fft round-trips through its inverse', () => {
  const n = 1024;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 5 * i) / n) + 0.5 * Math.cos((2 * Math.PI * 17 * i) / n);
  const orig = Float64Array.from(re);
  fft(re, im);
  fft(re, im, true);
  for (let i = 0; i < n; i++) {
    assert.ok(Math.abs(re[i] - orig[i]) < 1e-9, `re[${i}]`);
    assert.ok(Math.abs(im[i]) < 1e-9, `im[${i}]`);
  }
});

test('wavToFloat32 parses a 16-bit mono WAV', () => {
  const src = Float32Array.from([0, 0.5, -0.5, 1, -1, 0.25]);
  const { samples, sampleRate } = wavToFloat32(makeWav(src, 8000));
  assert.equal(sampleRate, 8000);
  assert.equal(samples.length, src.length);
  for (let i = 0; i < src.length; i++) {
    assert.ok(Math.abs(samples[i] - src[i]) < 1e-3, `sample ${i}: ${samples[i]} vs ${src[i]}`);
  }
});

test('wavToFloat32 rejects non-WAV bytes', () => {
  assert.throws(() => wavToFloat32(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])));
});

test('frequencyShift moves a 440 Hz tone to ~740 Hz', () => {
  const sr = 22050, n = 22050;
  const sine = new Float32Array(n);
  for (let i = 0; i < n; i++) sine[i] = Math.sin((2 * Math.PI * 440 * i) / sr);
  const hz = dominantHz(frequencyShift(sine, sr, 300), sr);
  assert.ok(Math.abs(hz - 740) < 5, `expected ~740 Hz, got ${hz}`);
});

test('duckify keeps length, stays in [-1,1], and actually changes the signal', () => {
  const sr = 22050, n = 4096;
  const sig = new Float32Array(n);
  for (let i = 0; i < n; i++) sig[i] = 0.6 * Math.sin((2 * Math.PI * 220 * i) / sr);
  const out = duckify(sig, sr);
  assert.equal(out.length, n);
  let peak = 0, diff = 0;
  for (let i = 0; i < n; i++) {
    peak = Math.max(peak, Math.abs(out[i]));
    diff += Math.abs(out[i] - sig[i]);
  }
  assert.ok(peak <= 1.0001, `peak ${peak}`);
  assert.ok(diff / n > 0.01, 'output too similar to input');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL — cannot find module `../site/js/duckdsp.js`

- [ ] **Step 4: Implement the module**

```js
// site/js/duckdsp.js
// Pure DSP for the duck narrator — no browser APIs, unit-tested in node.

// In-place iterative radix-2 FFT. re/im length must be a power of 2.
export function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const j = i + k + len / 2;
        const vr = re[j] * cr - im[j] * ci;
        const vi = re[j] * ci + im[j] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[j] = ur - vr; im[j] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
}

// 16-bit PCM WAV → mono Float32 samples (first channel) + sample rate.
export function wavToFloat32(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.byteLength < 12 || dv.getUint32(0, false) !== 0x52494646 || dv.getUint32(8, false) !== 0x57415645) {
    throw new Error('not a WAV file');
  }
  let off = 12, sampleRate = 0, dataOff = -1, dataLen = 0, bits = 0, channels = 1;
  while (off + 8 <= dv.byteLength) {
    const id = dv.getUint32(off, false);
    const size = dv.getUint32(off + 4, true);
    if (id === 0x666d7420) { // 'fmt '
      channels = dv.getUint16(off + 10, true);
      sampleRate = dv.getUint32(off + 12, true);
      bits = dv.getUint16(off + 22, true);
    } else if (id === 0x64617461) { // 'data'
      dataOff = off + 8;
      dataLen = Math.min(size, dv.byteLength - dataOff);
    }
    off += 8 + size + (size & 1);
  }
  if (dataOff < 0 || bits !== 16 || sampleRate === 0) throw new Error('unsupported WAV');
  const frames = Math.floor(dataLen / 2 / channels);
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) samples[i] = dv.getInt16(dataOff + i * 2 * channels, true) / 32768;
  return { samples, sampleRate };
}

// Shift every frequency component up by shiftHz (analytic-signal / SSB method
// — the literal "Donald Duck effect"). Output has the input's length.
export function frequencyShift(samples, sampleRate, shiftHz) {
  const n = samples.length;
  let N = 1;
  while (N < n) N <<= 1;
  const re = new Float64Array(N), im = new Float64Array(N);
  re.set(samples);
  fft(re, im);
  // Analytic signal: keep DC and Nyquist, double positives, zero negatives.
  for (let k = 1; k < N / 2; k++) { re[k] *= 2; im[k] *= 2; }
  for (let k = N / 2 + 1; k < N; k++) { re[k] = 0; im[k] = 0; }
  fft(re, im, true);
  const out = new Float32Array(n);
  const w = (2 * Math.PI * shiftHz) / sampleRate;
  for (let t = 0; t < n; t++) out[t] = re[t] * Math.cos(w * t) - im[t] * Math.sin(w * t);
  return out;
}

// Duck voice: waveshaping buzz first (adds harmonics), then frequency shift
// (makes them inharmonic). Peak-normalized to 0.9.
export function duckify(samples, sampleRate, { shiftHz = 320, drive = 2.2 } = {}) {
  const norm = Math.tanh(drive);
  const buzzed = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) buzzed[i] = Math.tanh(samples[i] * drive) / norm;
  const shifted = frequencyShift(buzzed, sampleRate, shiftHz);
  let peak = 0;
  for (let i = 0; i < shifted.length; i++) peak = Math.max(peak, Math.abs(shifted[i]));
  if (peak > 0) {
    const g = 0.9 / peak;
    for (let i = 0; i < shifted.length; i++) shifted[i] *= g;
  }
  return shifted;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/`
Expected: 5 passing, 0 failing

- [ ] **Step 6: Commit**

```bash
git add package.json tests/duckdsp.test.js site/js/duckdsp.js
git commit -m "Add duck-effect DSP module with node tests"
```

---

### Task 3: Browser voice module (`voice.js`)

**Files:**
- Create: `site/js/voice.js`

**Interfaces:**
- Consumes: `wavToFloat32`, `duckify` from `./duckdsp.js`; global `meSpeak` from `vendor/mespeak.js` (lazy script load).
- Produces (exports):
  - `speak(text: string, opts?: { onEnd?: () => void }): Promise<void>` — resolves once playback has *started*; `onEnd` fires when playback finishes or is stopped. Throws on engine-load/synthesis failure and marks the module failed.
  - `stop(): void` — stops any current playback (safe when idle).
  - `isSpeaking(): boolean`
  - `isFailed(): boolean` — true after any failure; callers should disable their UI.

No unit tests (thin browser glue over tested DSP); exercised in Task 6's manual verification.

- [ ] **Step 1: Implement the module**

```js
// site/js/voice.js
// Duck narrator: lazy-loads the vendored meSpeak engine, synthesizes text,
// runs it through duckdsp, and plays via Web Audio. Singleton — one voice
// at a time across the whole app.
import { wavToFloat32, duckify } from './duckdsp.js';

let ctx = null;
let current = null;      // active AudioBufferSourceNode
let enginePromise = null;
let failed = false;

function loadEngine() {
  enginePromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/mespeak.js';
    s.onload = () => (window.meSpeak?.speak ? resolve() : reject(new Error('meSpeak missing after load')));
    s.onerror = () => reject(new Error('failed to load speech engine'));
    document.head.append(s);
  });
  return enginePromise;
}

export function isSpeaking() {
  return current !== null;
}

export function isFailed() {
  return failed;
}

export function stop() {
  if (!current) return;
  const src = current;
  current = null;
  try { src.stop(); } catch { /* already ended */ }
}

export async function speak(text, { onEnd } = {}) {
  stop();
  try {
    await loadEngine();
    const raw = window.meSpeak.speak(text, { rawdata: 'array', pitch: 65, speed: 165, amplitude: 100 });
    if (!raw || raw.length < 44) throw new Error('synthesis produced no audio');
    const { samples, sampleRate } = wavToFloat32(new Uint8Array(raw));
    const duck = duckify(samples, sampleRate);
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    const buf = ctx.createBuffer(1, duck.length, sampleRate);
    buf.getChannelData(0).set(duck);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => {
      if (current === src) current = null;
      onEnd?.();
    };
    current = src;
    src.start();
  } catch (err) {
    failed = true;
    throw err;
  }
}
```

- [ ] **Step 2: Syntax-check the module**

Run: `node --check site/js/voice.js`
Expected: no output (exit 0)

- [ ] **Step 3: Commit**

```bash
git add site/js/voice.js
git commit -m "Add duck voice module: lazy engine load, duckify, Web Audio playback"
```

---

### Task 4: Duck button component + styles

**Files:**
- Create: `site/js/components/duckButton.js`
- Modify: `site/css/components.css` (append after the `.q-diff` rule, ~line 76)

**Interfaces:**
- Consumes: `el` from `./dom.js`; `speak`/`stop`/`isSpeaking`/`isFailed` from `../voice.js`.
- Produces: `duckButton(text: string): HTMLButtonElement` — self-contained toggle; states: idle 🦆 / `.loading` / `.quacking` / disabled 🚫 on failure.

- [ ] **Step 1: Implement the component**

```js
// site/js/components/duckButton.js
import { el } from './dom.js';
import * as voice from '../voice.js';

// Toggle button that reads `text` aloud in the duck voice. Disables itself
// (and renders pre-disabled) once the speech engine has failed this session.
export function duckButton(text) {
  const btn = el('button', {
    class: 'duck-btn',
    'aria-label': 'Read question aloud',
    title: 'Read question aloud',
  }, '🦆');

  if (voice.isFailed()) fail();
  let busy = false;

  btn.onclick = async () => {
    if (busy || btn.disabled) return;
    if (voice.isSpeaking()) { voice.stop(); return; }
    busy = true;
    btn.classList.add('loading');
    try {
      await voice.speak(text, { onEnd: () => btn.classList.remove('quacking') });
      btn.classList.add('quacking');
    } catch {
      fail();
    } finally {
      busy = false;
      btn.classList.remove('loading');
    }
  };

  function fail() {
    btn.disabled = true;
    btn.textContent = '🚫';
    btn.title = "Can't quack — speech engine unavailable";
  }

  return btn;
}
```

- [ ] **Step 2: Add styles**

Append to `site/css/components.css` directly after the `.q-diff` rule:

```css
.duck-btn {
  margin-left: auto;
  border: 1px solid var(--hairline-strong);
  background: transparent;
  border-radius: 999px;
  font-size: 1rem;
  line-height: 1.4;
  padding: 0.1rem 0.55rem;
  cursor: pointer;
}
.duck-btn:hover:not(:disabled) { background: var(--accent-soft); }
.duck-btn:disabled { opacity: 0.45; cursor: default; }
.duck-btn.loading { animation: duck-pulse 0.9s ease-in-out infinite; }
.duck-btn.quacking { animation: duck-bob 0.35s ease-in-out infinite; }
@keyframes duck-pulse { 50% { opacity: 0.35; } }
@keyframes duck-bob { 50% { transform: translateY(-2px) rotate(-8deg); } }
[data-reduced-motion] .duck-btn.loading,
[data-reduced-motion] .duck-btn.quacking { animation: none; }
```

- [ ] **Step 3: Syntax-check and commit**

Run: `node --check site/js/components/duckButton.js`
Expected: exit 0

```bash
git add site/js/components/duckButton.js site/css/components.css
git commit -m "Add duck narrator button component and styles"
```

---

### Task 5: Wire into streak mode (questionCard)

**Files:**
- Modify: `site/js/components/questionCard.js` (imports, q-meta row at lines 24-27, `finish()` at lines 32-40)
- Modify: `site/js/screens/streak.js` (`root.cleanup` at line 103)

**Interfaces:**
- Consumes: `duckButton(text)` from `./duckButton.js`; `stop` from `../voice.js`.

- [ ] **Step 1: Add the button to the card and stop speech on answer**

In `site/js/components/questionCard.js`, add imports after line 2:

```js
import { duckButton } from './duckButton.js';
import { stop as stopVoice } from '../voice.js';
```

Change the q-meta row (lines 24-27) to include the button:

```js
    el('div', { class: 'q-meta' },
      el('span', { class: 'q-topic-tag' }, topicTitle),
      el('span', { class: 'q-diff' }, q.difficulty),
      duckButton(q.stem),
    ),
```

Add `stopVoice()` as the first line of `finish()`:

```js
  function finish(pickedIndex) {
    stopVoice();
    answered = true;
```

- [ ] **Step 2: Stop speech when leaving the streak screen**

In `site/js/screens/streak.js`, add import after line 8:

```js
import { stop as stopVoice } from '../voice.js';
```

Change line 103 from `root.cleanup = () => activeTimer?.stop();` to:

```js
  root.cleanup = () => { activeTimer?.stop(); stopVoice(); };
```

- [ ] **Step 3: Syntax-check and commit**

Run: `node --check site/js/components/questionCard.js && node --check site/js/screens/streak.js`
Expected: exit 0

```bash
git add site/js/components/questionCard.js site/js/screens/streak.js
git commit -m "Wire duck narrator into streak question cards"
```

---

### Task 6: Wire into exam mode

**Files:**
- Modify: `site/js/screens/exam.js` (imports at lines 1-4, `renderQuestion()` q-meta at lines 72-75, `finish()` at line 115, `root.cleanup` at line 211)

**Interfaces:**
- Consumes: `duckButton(text)` from `../components/duckButton.js`; `stop` from `../voice.js`.

- [ ] **Step 1: Add imports**

After line 4 of `site/js/screens/exam.js`:

```js
import { duckButton } from '../components/duckButton.js';
import { stop as stopVoice } from '../voice.js';
```

- [ ] **Step 2: Add the button and stop speech on question change / finish / leave**

In `renderQuestion()`, add `stopVoice();` as the first line (covers answer, skip, and back-to-back questions):

```js
    function renderQuestion() {
      stopVoice();
      const item = presented[idx];
```

Change the exam card's q-meta block (lines 72-75) to:

```js
      const card = el('div', { class: 'card qcard enter' },
        el('div', { class: 'q-meta' },
          el('span', { class: 'q-topic-tag' }, bank.topicTitle.get(item.q.topic) ?? item.q.topic),
          duckButton(item.q.stem),
        ),
```

In `finish()`, add `stopVoice();` right after the `finished` guard (covers the clock running out mid-quack):

```js
    function finish() {
      if (finished) return;
      finished = true;
      stopVoice();
```

Change line 211 from `root.cleanup = () => { if (clockInterval) clearInterval(clockInterval); };` to:

```js
  root.cleanup = () => { if (clockInterval) clearInterval(clockInterval); stopVoice(); };
```

- [ ] **Step 3: Syntax-check and commit**

Run: `node --check site/js/screens/exam.js`
Expected: exit 0

```bash
git add site/js/screens/exam.js
git commit -m "Wire duck narrator into exam mode"
```

---

### Task 7: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `node --test tests/ && node tools/check-mespeak.mjs && node tools/validate.mjs --quiet`
Expected: all tests pass, mespeak check OK, validator exits 0

- [ ] **Step 2: Serve the site and verify in a browser**

Run: `python3 -m http.server -d site 8000` then open `http://localhost:8000`.

Checklist (from the spec):
- Network tab: `vendor/mespeak.js` is NOT fetched on page load.
- Streak mode: 🦆 button sits right of the topic/difficulty tags; clicking reads the stem (duck-like: buzzy, inharmonic, high) and never the options; `vendor/mespeak.js` loads on this first click only.
- Clicking 🦆 mid-speech stops it; clicking again replays.
- Answering mid-speech stops it; with a 15s question timer, timeout also stops it.
- Exam mode: button appears on each question; Skip/answer mid-speech stops it; navigating to another screen mid-speech stops it.
- Failure path: DevTools → Network → block `vendor/mespeak.js` (fresh reload) → click 🦆 → button becomes 🚫 disabled with "Can't quack" tooltip; quiz still fully playable; subsequent questions render the button pre-disabled.
- Reduced motion ON in settings: no button animation while loading/quacking.

- [ ] **Step 3: Fix anything found, then final commit if changes were made**

Any fix goes through the failing-test-first cycle when it touches `duckdsp.js`; UI fixes are verified by repeating Step 2.

```bash
git add -A && git commit -m "Duck narrator: post-verification fixes"
```
