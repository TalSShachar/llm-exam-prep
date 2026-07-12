import { el } from './dom.js';
import { presentOptions } from '../engine.js';
import { duckButton } from './duckButton.js';
import { stop as stopVoice } from '../voice.js';

const KEYS = ['A', 'B', 'C', 'D'];

// Renders one question. Calls onAnswer(correct:boolean, pickedIndex|null) exactly once.
// Returns the card element; card.reveal() shows the answer (used on timeout).
export function questionCard(q, topicTitle, onAnswer) {
  const { options, correctIndex } = presentOptions(q);
  let answered = false;

  const buttons = options.map((text, i) =>
    el(
      'button',
      { class: 'q-opt', onclick: () => pick(i) },
      el('span', { class: 'opt-key', 'aria-hidden': 'true' }, KEYS[i]),
      el('span', {}, text),
    ),
  );

  const card = el(
    'div',
    { class: 'card qcard enter' },
    el('div', { class: 'q-meta' },
      el('span', { class: 'q-topic-tag' }, topicTitle),
      el('span', { class: 'q-diff' }, q.difficulty),
      duckButton(q.stem),
    ),
    el('h2', { class: 'q-stem' }, q.stem),
    el('div', { class: 'q-options', role: 'group', 'aria-label': 'Answer options' }, buttons),
  );

  function finish(pickedIndex) {
    stopVoice();
    answered = true;
    buttons.forEach((b) => (b.disabled = true));
    buttons[correctIndex].classList.add('correct');
    const correct = pickedIndex === correctIndex;
    if (pickedIndex != null && !correct) buttons[pickedIndex].classList.add('wrong');
    card.classList.add(correct ? 'flash-good' : 'shake');
    onAnswer(correct, pickedIndex);
  }

  function pick(i) {
    if (!answered) finish(i);
  }

  card.reveal = () => { if (!answered) finish(null); };

  // Keyboard: A-D / 1-4 answer, when card is on screen.
  card.onKey = (e) => {
    if (answered) return false;
    const k = e.key.toUpperCase();
    let i = KEYS.indexOf(k);
    if (i === -1 && /^[1-4]$/.test(k)) i = Number(k) - 1;
    if (i >= 0) { pick(i); return true; }
    return false;
  };

  return card;
}
