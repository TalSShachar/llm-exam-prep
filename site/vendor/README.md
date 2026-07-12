# site/vendor

## mespeak.js (~1.9 MB)

meSpeak 2.0.2 (https://www.npmjs.com/package/mespeak) — an emscripten build of
eSpeak — bundled into a single IIFE with its config and the en-US voice baked
in. Exposes global `meSpeak`. Rebuild with `tools/vendor-mespeak.sh`; smoke
test with `node tools/check-mespeak.mjs`.

License: GPLv3 (eSpeak / meSpeak). Source for the exact build inputs is the
npm tarball pinned above.
