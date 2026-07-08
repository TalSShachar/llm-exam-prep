// Pure game logic: sampling, recency, shuffling, exam building.

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ringCap(poolSize) {
  return Math.max(5, Math.min(120, Math.floor(poolSize / 3)));
}

// Pick a random question not in the seen ring; if the ring exhausts the pool,
// evict the older half of the ring and retry.
export function pickNext(pool, seen) {
  if (pool.length === 0) return null;
  const seenSet = new Set(seen);
  let candidates = pool.filter((q) => !seenSet.has(q.id));
  if (candidates.length === 0) {
    seen.splice(0, Math.ceil(seen.length / 2));
    const smaller = new Set(seen);
    candidates = pool.filter((q) => !smaller.has(q.id));
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function pushSeen(seen, id, cap) {
  seen.push(id);
  while (seen.length > cap) seen.shift();
}

// Per-presentation option order. Returns shuffled texts + index of the correct one.
export function presentOptions(q) {
  const order = shuffle([0, 1, 2, 3]);
  return {
    options: order.map((i) => q.options[i]),
    correctIndex: order.indexOf(q.answer),
  };
}

// Stratified exam: allocate n across topics proportionally (largest remainder),
// then sample without replacement inside each topic.
export function buildExam(byTopic, n = 50) {
  const topics = [...byTopic.entries()].filter(([, qs]) => qs.length > 0);
  const total = topics.reduce((s, [, qs]) => s + qs.length, 0);
  const target = Math.min(n, total);

  const alloc = topics.map(([id, qs]) => {
    const exact = (qs.length / total) * target;
    return { id, qs, base: Math.floor(exact), rem: exact % 1 };
  });
  let assigned = alloc.reduce((s, a) => s + a.base, 0);
  alloc.sort((a, b) => b.rem - a.rem);
  for (const a of alloc) {
    if (assigned >= target) break;
    if (a.base < a.qs.length) { a.base += 1; assigned += 1; }
  }
  // If rounding still left a shortfall (tiny topics maxed out), top up anywhere.
  for (const a of alloc) {
    while (assigned < target && a.base < a.qs.length) { a.base += 1; assigned += 1; }
  }

  const picked = alloc.flatMap((a) => shuffle(a.qs).slice(0, a.base));
  return shuffle(picked);
}

export function fmtClock(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function streakTier(n) {
  if (n >= 25) return 4;
  if (n >= 10) return 3;
  if (n >= 5) return 2;
  if (n >= 1) return 1;
  return 0;
}
