import { el, confettiBurst, toast } from '../components/dom.js';
import { state, update, recordAnswer } from '../state.js';
import { poolFor } from '../data.js';
import { pickNext, pushSeen, ringCap } from '../engine.js';
import { questionCard } from '../components/questionCard.js';
import { resultPanel } from '../components/resultPanel.js';
import { streakFlame, dropEmbers } from '../components/streakFlame.js';
import { timerRing } from '../components/timerRing.js';

export function render(bank) {
  const pool = poolFor(bank, state.settings.topics);
  let streak = 0;
  let celebrated = false; // one confetti per run
  let activeTimer = null;
  let activeCard = null;

  const meter = streakFlame('streak');
  const bestLine = el('span', { class: 'streak-sub' }, `best ${state.bestStreak}`);
  const timerSlot = el('div');
  const qSlot = el('div');

  const root = el(
    'div',
    { class: 'screen stack' },
    el('div', { class: 'row spread' },
      meter,
      el('div', { class: 'row' }, bestLine, timerSlot),
    ),
    qSlot,
  );

  if (pool.length === 0) {
    qSlot.append(el('div', { class: 'card center' },
      el('p', {}, 'No questions match your topic filter.'),
      el('a', { class: 'btn', href: '#/', style: 'margin-top:1rem' }, 'Adjust topics'),
    ));
    return root;
  }

  const cap = ringCap(pool.length);

  function nextQuestion() {
    activeTimer?.stop();
    activeTimer = null;
    timerSlot.replaceChildren();
    qSlot.replaceChildren();

    const q = pickNext(pool, state.seen);
    update((s) => pushSeen(s.seen, q.id, cap));

    const card = questionCard(q, bank.topicTitle.get(q.topic) ?? q.topic, (correct) => {
      activeTimer?.stop();
      recordAnswer(q.topic, correct);

      if (correct) {
        streak += 1;
        meter.set(streak, { pop: true });
        if (streak > state.bestStreak) {
          update((s) => { s.bestStreak = streak; });
          bestLine.textContent = `best ${state.bestStreak}`;
          if (!celebrated && streak >= 3) {
            celebrated = true;
            confettiBurst();
            toast(`🔥 New best streak: ${streak}!`);
          }
        }
      } else {
        if (streak > 0) dropEmbers(card);
        streak = 0;
        meter.set(0);
      }

      card.append(resultPanel(q, correct));
      const next = el('button', { class: 'btn btn-primary btn-block', style: 'margin-top:1rem', onclick: nextQuestion }, 'Next question →');
      card.append(next);
      if (correct) setTimeout(() => next.focus({ preventScroll: true }), 50);
      else next.focus({ preventScroll: true });
    });

    activeCard = card;
    qSlot.append(card);

    const secs = state.settings.qTimerSec;
    if (secs > 0) {
      const ring = timerRing(secs, () => card.reveal());
      activeTimer = ring;
      timerSlot.append(ring);
      ring.start();
    }
  }

  meter.set(0);
  nextQuestion();

  root.onKey = (e) => {
    if (e.key === 'Enter') {
      const btn = qSlot.querySelector('.btn-primary');
      if (btn) { btn.click(); return true; }
      return false;
    }
    return activeCard?.onKey?.(e) ?? false;
  };
  root.cleanup = () => activeTimer?.stop();
  return root;
}
