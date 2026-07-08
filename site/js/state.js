// Single persisted store. All mutations go through update() so persistence never drifts.
const KEY = 'llmquiz.v1';

const DEFAULTS = {
  bestStreak: 0,
  settings: {
    theme: 'system',        // system | light | dark
    qTimerSec: 0,           // 0 = off
    examCount: 50,
    examMinutes: 60,
    topics: [],             // empty = all topics
    reducedMotion: false,
  },
  seen: [],                 // recency ring of question ids
  topicStats: {},           // { t08: { attempts, correct } }
  examHistory: [],          // [{ ts, score, total, minutes }]
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      ...structuredClone(DEFAULTS),
      ...raw,
      settings: { ...DEFAULTS.settings, ...(raw.settings || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const state = load();

export function update(fn) {
  fn(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* private mode / quota — play on without persistence */ }
}

export function resetProgress() {
  update((s) => {
    s.bestStreak = 0;
    s.seen = [];
    s.topicStats = {};
    s.examHistory = [];
  });
}

export function recordAnswer(topicId, correct) {
  update((s) => {
    const t = (s.topicStats[topicId] ??= { attempts: 0, correct: 0 });
    t.attempts += 1;
    if (correct) t.correct += 1;
  });
}

export function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  if (state.settings.reducedMotion) document.documentElement.dataset.reducedMotion = 'true';
  else delete document.documentElement.dataset.reducedMotion;
}
