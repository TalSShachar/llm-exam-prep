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
