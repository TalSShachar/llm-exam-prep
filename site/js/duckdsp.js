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
