#!/usr/bin/env node
// Regenerates site/data/manifest.json from site/data/questions/*.json. Never hand-edit the manifest.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QDIR = join(ROOT, 'site', 'data', 'questions');
const OUT = join(ROOT, 'site', 'data', 'manifest.json');

const SHORT = {
  t00: 'Intro', t02: 'Ambiguity', t03: 'Prompting', t04: 'Agents Intro',
  t05: 'AI Agents', t06: 'Collab Agents', t07: 'Memory', t08: 'RAG',
  t09: 'Hard Problems', t10: 'Good Code', t11: 'Real World', t12: 'Verification',
};

const topics = [];
let total = 0;
for (const f of readdirSync(QDIR).filter((f) => f.endsWith('.json')).sort()) {
  const doc = JSON.parse(readFileSync(join(QDIR, f), 'utf8'));
  const sources = [];
  const seen = new Set();
  for (const q of doc.questions) {
    const key = `${q.source.kind}|${q.source.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      sources.push({ kind: q.source.kind, title: q.source.title, file: q.source.file });
    }
  }
  topics.push({
    id: doc.topic,
    title: doc.title,
    shortTitle: SHORT[doc.topic] ?? doc.title,
    count: doc.questions.length,
    file: `data/questions/${f}`,
    sources,
  });
  total += doc.questions.length;
}

writeFileSync(OUT, JSON.stringify({ version: 1, totalQuestions: total, topics }, null, 2) + '\n');
console.log(`manifest.json: ${topics.length} topics, ${total} questions`);
