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
