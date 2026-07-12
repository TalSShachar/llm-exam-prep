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
