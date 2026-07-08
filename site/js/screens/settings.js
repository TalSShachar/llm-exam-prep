import { el } from '../components/dom.js';
import { state, update, applyTheme } from '../state.js';

function segmented(options, current, onPick) {
  const seg = el('div', { class: 'seg', role: 'group' });
  const buttons = options.map(([value, label]) =>
    el('button', {
      class: value === current ? 'on' : '',
      'aria-pressed': String(value === current),
      onclick: () => {
        onPick(value);
        buttons.forEach((b, i) => {
          const on = options[i][0] === value;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', String(on));
        });
      },
    }, label),
  );
  seg.append(...buttons);
  return seg;
}

function row(name, desc, control) {
  return el('div', { class: 'setting-row' },
    el('div', {},
      el('div', { class: 'setting-name' }, name),
      el('div', { class: 'setting-desc' }, desc),
    ),
    control,
  );
}

export function render() {
  return el('div', { class: 'screen stack' },
    el('h1', { style: 'font-size:1.4rem' }, '⚙️ Settings'),
    el('div', { class: 'card' },
      row('Theme', 'System follows your device', segmented(
        [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']],
        state.settings.theme,
        (v) => { update((s) => { s.settings.theme = v; }); applyTheme(); },
      )),
      row('Question timer', 'Countdown per question in streak mode — timeout counts as wrong', segmented(
        [[0, 'Off'], [15, '15s'], [30, '30s'], [60, '60s']],
        state.settings.qTimerSec,
        (v) => update((s) => { s.settings.qTimerSec = v; }),
      )),
      row('Exam length', 'Questions per simulated exam', segmented(
        [[25, '25'], [50, '50'], [100, '100']],
        state.settings.examCount,
        (v) => update((s) => { s.settings.examCount = v; }),
      )),
      row('Exam duration', 'Minutes on the exam clock', segmented(
        [[30, '30'], [60, '60'], [90, '90']],
        state.settings.examMinutes,
        (v) => update((s) => { s.settings.examMinutes = v; }),
      )),
      row('Reduce motion', 'Tone down animations', segmented(
        [[false, 'Off'], [true, 'On']],
        state.settings.reducedMotion,
        (v) => { update((s) => { s.settings.reducedMotion = v; }); applyTheme(); },
      )),
    ),
    el('p', { class: 'small muted center' },
      'Built from the full course material — lectures, recitations, quizzes and homeworks. ',
      'Wrong answers point you to the exact source deck to study.'),
  );
}
