import { el, toast } from '../components/dom.js';
import { state, resetProgress } from '../state.js';

export function render(bank) {
  const stats = state.topicStats;
  const rows = bank.manifest.topics.map((t) => {
    const s = stats[t.id];
    const pct = s && s.attempts > 0 ? s.correct / s.attempts : null;
    return { ...t, s, pct };
  });

  const attempted = rows.filter((r) => r.pct != null);
  const totalAttempts = attempted.reduce((n, r) => n + r.s.attempts, 0);
  const totalCorrect = attempted.reduce((n, r) => n + r.s.correct, 0);
  const overallPct = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const weakest = attempted
    .filter((r) => r.s.attempts >= 5)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 2);

  const bars = rows.map((r) =>
    el('div', { class: 'tb-row' },
      el('span', { class: 'tb-label', title: r.title }, r.shortTitle),
      el('div', { class: 'tb-track' },
        Object.assign(el('div', { class: 'tb-fill' }), {
          style: `width:${r.pct != null ? r.pct * 100 : 0}%`,
        }),
      ),
      el('span', { class: 'tb-val' },
        r.pct != null ? `${Math.round(r.pct * 100)}% ` : '— ',
        el('span', { class: 'tb-n' }, r.pct != null ? `(${r.s.attempts})` : '(0)'),
      ),
    ),
  );

  const history = state.examHistory.slice().reverse().slice(0, 10).map((h) =>
    el('div', { class: 'history-item' },
      el('span', {}, new Date(h.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ` · ${h.minutes} min`),
      el('b', {}, `${h.score}/${h.total} (${Math.round((h.score / h.total) * 100)}%)`),
    ),
  );

  let armed = false;
  const resetBtn = el('button', {
    class: 'btn btn-danger',
    onclick: () => {
      if (!armed) {
        armed = true;
        resetBtn.textContent = 'Tap again to wipe everything';
        setTimeout(() => { armed = false; resetBtn.textContent = 'Reset all progress'; }, 3000);
        return;
      }
      resetProgress();
      toast('Progress reset');
      location.hash = '#/';
    },
  }, 'Reset all progress');

  return el('div', { class: 'screen stack' },
    el('h1', { style: 'font-size:1.4rem' }, '📊 Your stats'),
    el('div', { class: 'stat-tiles' },
      el('div', { class: 'stat-tile' },
        el('div', { class: 'st-value' }, `🔥 ${state.bestStreak}`),
        el('div', { class: 'st-label' }, 'best streak')),
      el('div', { class: 'stat-tile' },
        el('div', { class: 'st-value' }, String(totalAttempts)),
        el('div', { class: 'st-label' }, 'answered')),
      el('div', { class: 'stat-tile' },
        el('div', { class: 'st-value' }, totalAttempts ? `${overallPct}%` : '—'),
        el('div', { class: 'st-label' }, 'accuracy')),
    ),
    weakest.length
      ? el('div', { class: 'weak-callout' },
          el('span', { 'aria-hidden': 'true' }, '🎯'),
          el('span', {},
            'Focus here: ',
            el('b', {}, weakest.map((w) => w.title).join(' · ')),
            ' — your lowest accuracy so far.'),
        )
      : null,
    el('div', { class: 'card' },
      el('h2', { style: 'font-size:1.05rem; margin-bottom:0.9rem' }, 'Accuracy by topic'),
      el('div', { class: 'topic-bars' }, bars),
      el('p', { class: 'small muted', style: 'margin-top:0.8rem' }, 'Bar = share of correct answers · (n) = questions answered'),
    ),
    el('div', { class: 'card' },
      el('h2', { style: 'font-size:1.05rem; margin-bottom:0.4rem' }, 'Exam history'),
      history.length ? el('div', { class: 'history-list' }, history)
        : el('p', { class: 'muted small' }, 'No exams taken yet — try the simulation.'),
    ),
    el('div', { class: 'center' }, resetBtn),
  );
}
