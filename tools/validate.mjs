#!/usr/bin/env node
// Question-bank validator. Zero deps. Exits non-zero on any ERROR.
// Usage: node tools/validate.mjs [--quiet]
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QDIR = join(ROOT, 'site', 'data', 'questions');

const TOPICS = {
  t00: { title: 'Introduction', target: 40 },
  t02: { title: 'Handling Ambiguity & Inconsistency', target: 40 },
  t03: { title: 'Prompt Engineering', target: 45 },
  t04: { title: 'Intro to AI Agents & Benchmarking', target: 45 },
  t05: { title: 'AI Agents', target: 42 },
  t06: { title: 'Collaborative Agents', target: 42 },
  t07: { title: 'Agent Memory', target: 42 },
  t08: { title: 'Word Embeddings and RAG', target: 45 },
  t09: { title: 'Agent Strategies for Hard Problems', target: 40 },
  t10: { title: 'Generating Good Code & NF Properties', target: 40 },
  t11: { title: 'Real-World Problems', target: 40 },
  t12: { title: 'Verification', target: 39 },
};

const SOURCE_FILES = new Set([
  '2026 Topic 0- Introduction.pdf',
  '2026 Topic 2 - Handling ambiguity  inconsistency.pdf',
  '2026 Topic 3 - Prompt Engineering.pdf',
  '2026 Topic 4 - Introduction to AI agents  Benchmarking.pdf',
  '2026 Topic 5 - AI Agents.pdf',
  '2026 Topic 6- Collaborative Agents.pdf',
  '2026 Topic 7 - Agent Memory.pdf',
  '2026 topic 8 - Word  embeddings and RAG.pdf',
  '2026 Topic 9- Agent strategies for hard problems.pdf',
  '2026 Topic 10 - Generating good code,NF code properties.pdf',
  '2026 Topic 11 Real-world problems.pdf',
  '2026 Topic 12 - Verification.pdf',
  'Recitation 1 - Intro to GenAI  LLM Basics.pdf',
  'Recitation 2 - Using LLMs API.pdf',
  'Recitation 3 - Prompt patterns lab.pdf',
  'Recitation 4 Benchmarking  Evaluating LLMs.pdf',
  'Recitation8 RAG.pdf',
  'Recitation 9  Code Quality Clinic.pdf',
  'Recitation 10  Taming the Dragon.pdf',
  'Recitation 11  Solve real-world SE problems.pdf',
  'Recitation 12  Multi-Agent Orchestration Patterns.pdf',
  '_Recitation 13  The Grand Finale.pdf',
  'in-class-quiz-1-LLM-Basics.pdf',
  'in-class-quiz-2-LLM-API.pdf',
  'in-class-quiz-3-Prompt-eng.pdf',
  'in-class-quiz-4-LangGraph-benchmarks-evals.pdf',
  'in-class-quiz-5-agents.pdf',
  'in-class-quiz-6-collaborative-agents.pdf',
  'in-class-quiz-7-Agent-Memory-1.pdf',
  'in-class-quiz-7-agent-memory-2.pdf',
  'in-class-quiz-8-RAG.pdf',
  'in-class-quiz-9- Agent-strategies-hard-probs.pdf',
  'in-class-quiz-10-Generating good code,pptx.pdf',
  'in-class-quiz-11-Real-World_Problems.pdf',
  'HW1 (2).pdf', 'HW2 (1).pdf', 'HW3 (2).pdf', 'HW 4.pdf',
  'End-of-year-review.pdf',
]);

const KINDS = new Set(['lecture', 'recitation', 'quiz', 'homework', 'review']);
const DIFFS = new Set(['easy', 'medium', 'hard']);
const BANNED = [/all of the above/i, /none of the above/i, /^\(?[a-d]\)? (and|or) \(?[a-d]\)?$/i];

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter || 1);
};

if (!existsSync(QDIR)) { console.error(`No question dir: ${QDIR}`); process.exit(1); }
const files = readdirSync(QDIR).filter((f) => f.endsWith('.json')).sort();
if (files.length === 0) { console.error('No question files found.'); process.exit(1); }

const allIds = new Set();
const allStems = []; // {id, tokens}
const perTopic = {};

for (const file of files) {
  const path = join(QDIR, file);
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    err(`${file}: invalid JSON — ${e.message}`);
    continue;
  }
  const tid = doc.topic;
  if (!TOPICS[tid]) { err(`${file}: unknown topic "${tid}"`); continue; }
  if (file !== `${tid}.json`) warn(`${file}: filename doesn't match topic "${tid}"`);
  if (!Array.isArray(doc.questions)) { err(`${file}: "questions" is not an array`); continue; }

  const answerHist = [0, 0, 0, 0];
  const diffHist = { easy: 0, medium: 0, hard: 0 };
  let notCount = 0;

  for (const q of doc.questions) {
    const qid = q.id ?? '(missing id)';
    const ctx = `${file} ${qid}`;
    if (typeof q.id !== 'string' || !new RegExp(`^${tid}-q\\d{3}$`).test(q.id)) err(`${ctx}: bad id format`);
    if (allIds.has(q.id)) err(`${ctx}: duplicate id`);
    allIds.add(q.id);
    if (typeof q.stem !== 'string' || q.stem.trim().length < 15) err(`${ctx}: stem missing/too short`);
    else if (q.stem.length > 340) warn(`${ctx}: stem over 340 chars (${q.stem.length})`);
    if (!Array.isArray(q.options) || q.options.length !== 4) err(`${ctx}: needs exactly 4 options`);
    else {
      const trimmed = q.options.map((o) => String(o).trim());
      if (trimmed.some((o) => !o)) err(`${ctx}: empty option`);
      if (new Set(trimmed.map((o) => o.toLowerCase())).size !== 4) err(`${ctx}: duplicate options`);
      for (const o of trimmed) if (BANNED.some((re) => re.test(o))) err(`${ctx}: banned option "${o}"`);
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) err(`${ctx}: answer must be int 0-3`);
    else answerHist[q.answer]++;
    if (typeof q.explanation !== 'string' || q.explanation.trim().length < 20) err(`${ctx}: explanation missing/too short`);
    const s = q.source || {};
    if (!SOURCE_FILES.has(s.file)) err(`${ctx}: source.file not in allowlist: "${s.file}"`);
    if (!KINDS.has(s.kind)) err(`${ctx}: bad source.kind "${s.kind}"`);
    if (typeof s.title !== 'string' || !s.title) err(`${ctx}: missing source.title`);
    if (typeof s.pages !== 'string' || !/^\d+([-,]\d+)*$/.test(s.pages)) err(`${ctx}: bad source.pages "${s.pages}"`);
    if (!DIFFS.has(q.difficulty)) err(`${ctx}: bad difficulty "${q.difficulty}"`);
    else diffHist[q.difficulty]++;
    if (!Array.isArray(q.tags) || q.tags.length < 1) warn(`${ctx}: missing tags`);
    if (/\bNOT\b|\bnot\b.*\?$/.test(q.stem) && /which|what/i.test(q.stem) && /NOT/.test(q.stem)) notCount++;
    if (typeof q.stem === 'string') allStems.push({ id: qid, tokens: normalize(q.stem) });
  }

  const n = doc.questions.length;
  const target = TOPICS[tid].target;
  if (Math.abs(n - target) > 3) warn(`${file}: ${n} questions vs target ${target}`);
  const maxShare = Math.max(...answerHist) / (n || 1);
  if (maxShare > 0.35 && n >= 20) err(`${file}: answer-index imbalance ${answerHist.join('/')} (max ${(maxShare * 100).toFixed(0)}%)`);
  if (notCount / (n || 1) > 0.15) warn(`${file}: ${notCount} NOT-style stems (> 15%)`);
  perTopic[tid] = { n, answerHist, diffHist };
}

// near-duplicate stems across the whole bank
for (let i = 0; i < allStems.length; i++) {
  for (let j = i + 1; j < allStems.length; j++) {
    const sim = jaccard(allStems[i].tokens, allStems[j].tokens);
    if (sim > 0.8) err(`near-duplicate stems: ${allStems[i].id} ~ ${allStems[j].id} (jaccard ${sim.toFixed(2)})`);
    else if (sim > 0.7) warn(`similar stems: ${allStems[i].id} ~ ${allStems[j].id} (jaccard ${sim.toFixed(2)})`);
  }
}

// report
const total = Object.values(perTopic).reduce((s, t) => s + t.n, 0);
console.log('topic  count  answers(0/1/2/3)  easy/med/hard');
for (const [tid, t] of Object.entries(perTopic).sort()) {
  console.log(
    `${tid}    ${String(t.n).padStart(3)}   ${t.answerHist.join('/').padEnd(15)}  ${t.diffHist.easy}/${t.diffHist.medium}/${t.diffHist.hard}`
  );
}
console.log(`TOTAL  ${total} questions in ${files.length} files`);

if (!process.argv.includes('--quiet')) {
  for (const w of warnings) console.log(`WARN  ${w}`);
}
for (const e of errors) console.error(`ERROR ${e}`);
console.log(`\n${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
