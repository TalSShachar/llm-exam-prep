import { el } from './dom.js';

const KIND_LABEL = { lecture: 'Lecture', recitation: 'Recitation', quiz: 'In-class quiz', homework: 'Homework', review: 'Review' };

export function sourcePill(q, label = 'Study: ') {
  const s = q.source;
  return el(
    'span',
    { class: 'source-pill' },
    el('span', { 'aria-hidden': 'true' }, '📖'),
    el('span', {},
      label,
      el('b', {}, s.title),
      ` — ${KIND_LABEL[s.kind] ?? s.kind}, pp. ${s.pages}`,
    ),
  );
}

export function resultPanel(q, correct) {
  return el(
    'div',
    { class: `result-panel ${correct ? 'good' : 'bad'}` },
    el('div', { class: 'rp-verdict' }, correct ? '✓ Correct' : '✗ Wrong'),
    el('p', { class: 'rp-expl' }, q.explanation),
    sourcePill(q, correct ? 'Source: ' : 'Study: '),
  );
}
