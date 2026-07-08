// Loads manifest + all topic files once; exposes indexed bank.
let bankPromise = null;

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export function loadBank() {
  bankPromise ??= (async () => {
    const manifest = await fetchJSON('data/manifest.json');
    const docs = await Promise.all(manifest.topics.map((t) => fetchJSON(t.file)));
    const questions = [];
    const byTopic = new Map();
    const topicTitle = new Map();
    for (const doc of docs) {
      topicTitle.set(doc.topic, doc.title);
      const list = doc.questions.map((q) => ({ ...q, topic: doc.topic }));
      byTopic.set(doc.topic, list);
      questions.push(...list);
    }
    const byId = new Map(questions.map((q) => [q.id, q]));
    return { manifest, questions, byId, byTopic, topicTitle };
  })();
  return bankPromise;
}

export function poolFor(bank, topicIds) {
  if (!topicIds || topicIds.length === 0) return bank.questions;
  const set = new Set(topicIds);
  return bank.questions.filter((q) => set.has(q.topic));
}
