import { el } from '../components/dom.js';
import { examCountdown } from '../components/examCountdown.js';
import { state, update } from '../state.js';

export function render(bank) {
  const chips = bank.manifest.topics.map((t) => {
    const on = state.settings.topics.includes(t.id);
    const chip = el(
      'button',
      {
        class: `chip${on ? ' on' : ''}`,
        'aria-pressed': String(on),
        onclick: () => {
          update((s) => {
            const list = s.settings.topics;
            const i = list.indexOf(t.id);
            if (i === -1) list.push(t.id);
            else list.splice(i, 1);
          });
          const nowOn = state.settings.topics.includes(t.id);
          chip.classList.toggle('on', nowOn);
          chip.setAttribute('aria-pressed', String(nowOn));
          updateHint();
        },
      },
      t.shortTitle,
      el('span', { class: 'chip-count' }, t.count),
    );
    return chip;
  });

  const hint = el('p', { class: 'muted small' });
  function updateHint() {
    const n = state.settings.topics.length;
    hint.textContent = n === 0
      ? `All topics · ${bank.manifest.totalQuestions} questions in play`
      : `${n} topic${n > 1 ? 's' : ''} selected — streak mode draws only from these`;
  }
  updateHint();

  const modeCard = (icon, title, desc, href) =>
    el('a', { class: 'mode-card', href },
      el('span', { class: 'mc-icon', 'aria-hidden': 'true' }, icon),
      el('span', { class: 'mc-title' }, title),
      el('span', { class: 'mc-desc' }, desc),
    );

  const countdown = examCountdown();

  const root = el(
    'div',
    { class: 'screen stack' },
    el('div', { class: 'hero' },
      el('h1', {}, 'Programming Using LLMs'),
      el('p', {}, 'Final-exam practice — build a streak, find your weak spots.'),
      state.bestStreak > 0
        ? el('div', { class: 'best-badge' }, '🔥', `Best streak: ${state.bestStreak}`)
        : null,
    ),
    countdown,
    el('div', { class: 'mode-grid' },
      modeCard('🔥', 'Streak', 'Endless questions. One miss resets the flame.', '#/streak'),
      modeCard('📝', 'Exam Simulation', `${state.settings.examCount} questions, ${state.settings.examMinutes} min — like the real thing.`, '#/exam'),
      modeCard('📊', 'Stats', 'Accuracy per topic and exam history.', '#/stats'),
      modeCard('⚙️', 'Settings', 'Theme, timers, exam length.', '#/settings'),
    ),
    el('div', { class: 'card stack' },
      el('div', {},
        el('h2', { style: 'font-size:1.05rem' }, 'Topic filter'),
        hint,
      ),
      el('div', { class: 'topic-chips' }, chips),
    ),
  );
  root.cleanup = () => countdown.stop();
  return root;
}
