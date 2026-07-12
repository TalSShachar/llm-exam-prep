import { el } from '../components/dom.js';
import { state, update, recordAnswer } from '../state.js';
import { buildExam, fmtClock, presentOptions } from '../engine.js';
import { sourcePill } from '../components/resultPanel.js';
import { duckButton } from '../components/duckButton.js';
import { stop as stopVoice } from '../voice.js';

const KEYS = ['A', 'B', 'C', 'D'];

export function render(bank) {
  const root = el('div', { class: 'screen stack' });
  let clockInterval = null;

  function showIntro() {
    const count = Math.min(state.settings.examCount, bank.questions.length);
    root.replaceChildren(
      el('div', { class: 'card center stack' },
        el('h1', { style: 'font-size:1.5rem' }, '📝 Exam Simulation'),
        el('p', { class: 'muted' },
          `${count} questions drawn across all topics, ${state.settings.examMinutes} minutes on the clock. ` +
          'No feedback until the end — just like the real final.'),
        el('button', { class: 'btn btn-primary', onclick: startExam }, 'Start exam'),
        el('a', { class: 'btn btn-ghost', href: '#/' }, 'Back'),
      ),
    );
  }

  function startExam() {
    const paper = buildExam(bank.byTopic, state.settings.examCount);
    const presented = paper.map((q) => ({ q, ...presentOptions(q), picked: null }));
    const startTs = Date.now();
    const totalSec = state.settings.examMinutes * 60;
    let idx = 0;

    const clock = el('span', { class: 'exam-clock' }, fmtClock(totalSec));
    const fill = el('div');
    const counter = el('span', { class: 'exam-count' });
    const qSlot = el('div');

    root.replaceChildren(
      el('div', { class: 'exam-top' },
        counter,
        el('div', { class: 'exam-progress' }, fill),
        clock,
      ),
      qSlot,
    );

    clockInterval = setInterval(() => {
      const left = totalSec - Math.floor((Date.now() - startTs) / 1000);
      clock.textContent = fmtClock(Math.max(0, left));
      clock.classList.toggle('low', left <= 300);
      if (left <= 0) finish();
    }, 500);

    function renderQuestion() {
      stopVoice();
      const item = presented[idx];
      counter.textContent = `${idx + 1}/${presented.length}`;
      fill.style.width = `${(idx / presented.length) * 100}%`;

      const buttons = item.options.map((text, i) =>
        el('button', {
          class: 'q-opt',
          onclick: () => {
            item.picked = i;
            advance();
          },
        },
          el('span', { class: 'opt-key', 'aria-hidden': 'true' }, KEYS[i]),
          el('span', {}, text),
        ),
      );

      const card = el('div', { class: 'card qcard enter' },
        el('div', { class: 'q-meta' },
          el('span', { class: 'q-topic-tag' }, bank.topicTitle.get(item.q.topic) ?? item.q.topic),
          duckButton(item.q.stem),
        ),
        el('h2', { class: 'q-stem' }, item.q.stem),
        el('div', { class: 'q-options' }, buttons),
        el('div', { class: 'row spread', style: 'margin-top:1rem' },
          el('button', { class: 'btn btn-ghost', onclick: () => advance() }, 'Skip'),
          el('button', { class: 'btn btn-danger', onclick: confirmEnd }, 'End exam'),
        ),
      );
      qSlot.replaceChildren(card);
      root.onKey = (e) => {
        const k = e.key.toUpperCase();
        let i = KEYS.indexOf(k);
        if (i === -1 && /^[1-4]$/.test(k)) i = Number(k) - 1;
        if (i >= 0 && i < buttons.length) { buttons[i].click(); return true; }
        return false;
      };
    }

    let endArmed = false;
    function confirmEnd() {
      if (endArmed) { finish(); return; }
      endArmed = true;
      const btn = qSlot.querySelector('.btn-danger');
      if (btn) btn.textContent = 'Sure? Tap again';
      setTimeout(() => {
        endArmed = false;
        const b = qSlot.querySelector('.btn-danger');
        if (b) b.textContent = 'End exam';
      }, 2500);
    }

    function advance() {
      idx += 1;
      if (idx >= presented.length) finish();
      else renderQuestion();
    }

    renderQuestion();

    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      stopVoice();
      clearInterval(clockInterval);
      clockInterval = null;

      const minutes = Math.max(1, Math.round((Date.now() - startTs) / 60000));
      let score = 0;
      const perTopic = {};
      for (const item of presented) {
        const t = (perTopic[item.q.topic] ??= { attempts: 0, correct: 0 });
        t.attempts += 1;
        const correct = item.picked === item.correctIndex;
        if (correct) { score += 1; t.correct += 1; }
        recordAnswer(item.q.topic, correct);
      }
      update((s) => {
        s.examHistory.push({ ts: Date.now(), score, total: presented.length, minutes });
        while (s.examHistory.length > 20) s.examHistory.shift();
      });
      showResults(score, presented, perTopic, minutes);
    }
  }

  function showResults(score, presented, perTopic, minutes) {
    root.onKey = null;
    const total = presented.length;
    const pct = Math.round((score / total) * 100);
    const R = 74, CIRC = 2 * Math.PI * R;

    const dial = el('div', { class: 'score-dial' });
    dial.innerHTML =
      `<svg width="170" height="170" viewBox="0 0 170 170">
         <circle class="dial-bg" cx="85" cy="85" r="${R}" fill="none" stroke-width="12"/>
         <circle class="dial-fg" cx="85" cy="85" r="${R}" fill="none" stroke-width="12"
                 stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/>
       </svg>
       <div class="dial-center">
         <span class="dial-score">${score}/${total}</span>
         <span class="dial-sub">${pct}% · ${minutes} min</span>
       </div>`;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        dial.querySelector('.dial-fg').style.strokeDashoffset = String(CIRC * (1 - score / total));
      }),
    );

    const topicRows = Object.entries(perTopic)
      .map(([tid, t]) => ({ tid, ...t, pct: t.correct / t.attempts }))
      .sort((a, b) => a.pct - b.pct)
      .map((t) =>
        el('div', { class: 'tb-row' },
          el('span', { class: 'tb-label' }, bank.manifest.topics.find((x) => x.id === t.tid)?.shortTitle ?? t.tid),
          el('div', { class: 'tb-track' }, Object.assign(el('div', { class: 'tb-fill' }), { style: `width:${t.pct * 100}%` })),
          el('span', { class: 'tb-val' }, `${t.correct}/${t.attempts}`),
        ),
      );

    const mistakes = presented.filter((it) => it.picked !== it.correctIndex);
    const reviewItems = mistakes.map((it) =>
      el('div', { class: 'review-item' },
        el('div', { class: 'review-q' }, it.q.stem),
        el('div', { class: 'review-a' },
          el('div', { class: 'you' }, `✗ You: ${it.picked == null ? '(skipped)' : it.options[it.picked]}`),
          el('div', { class: 'ans' }, `✓ Answer: ${it.options[it.correctIndex]}`),
        ),
        el('p', { class: 'small muted', style: 'margin-top:0.3rem' }, it.q.explanation),
        sourcePill(it.q),
      ),
    );

    root.replaceChildren(
      el('div', { class: 'screen stack' },
        el('div', { class: 'card center stack' },
          el('h1', { style: 'font-size:1.4rem' }, pct >= 60 ? '🎉 Exam complete' : 'Exam complete'),
          dial,
          el('div', { class: 'row', style: 'justify-content:center' },
            el('button', { class: 'btn btn-primary', onclick: () => { showIntro(); } }, 'Try again'),
            el('a', { class: 'btn', href: '#/stats' }, 'View stats'),
          ),
        ),
        el('div', { class: 'card' },
          el('h2', { style: 'font-size:1.05rem; margin-bottom:0.8rem' }, 'By topic (weakest first)'),
          el('div', { class: 'topic-bars' }, topicRows),
        ),
        mistakes.length
          ? el('div', { class: 'card' },
              el('h2', { style: 'font-size:1.05rem; margin-bottom:0.4rem' }, `Review your ${mistakes.length} mistake${mistakes.length > 1 ? 's' : ''}`),
              ...reviewItems,
            )
          : el('div', { class: 'card center' }, el('p', {}, '💯 Perfect run — nothing to review.')),
      ),
    );
  }

  showIntro();
  root.cleanup = () => { if (clockInterval) clearInterval(clockInterval); stopVoice(); };
  return root;
}
