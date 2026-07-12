// site/js/voice.js
// Duck narrator: lazy-loads the vendored meSpeak engine, synthesizes text,
// runs it through duckdsp, and plays via Web Audio. Singleton — one voice
// at a time across the whole app.
import { wavToFloat32, duckify } from './duckdsp.js';

let ctx = null;
let current = null;      // active AudioBufferSourceNode
let enginePromise = null;
let failed = false;
let gen = 0;              // bumped to cancel any in-flight speak()

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
  gen++; // cancel any in-flight speak() before touching current
  if (!current) return;
  const src = current;
  current = null;
  try { src.stop(); } catch { /* already ended */ }
}

export async function speak(text, { onEnd } = {}) {
  stop();
  const myGen = gen;
  try {
    await loadEngine();
    if (gen !== myGen) { onEnd?.(); return false; } // cancelled while loading
    const raw = window.meSpeak.speak(text, { rawdata: 'array', pitch: 65, speed: 165, amplitude: 100 });
    if (!raw || raw.length < 44) throw new Error('synthesis produced no audio');
    const { samples, sampleRate } = wavToFloat32(new Uint8Array(raw));
    const duck = duckify(samples, sampleRate);
    if (duck.length === 0) { onEnd?.(); return false; } // degenerate synthesis, not a failure
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    if (gen !== myGen) { onEnd?.(); return false; } // cancelled while resuming context
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
    return true;
  } catch (err) {
    if (gen !== myGen) { onEnd?.(); return false; } // stale failure from a cancelled speak
    failed = true;
    throw err;
  }
}
