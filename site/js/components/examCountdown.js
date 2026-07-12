import { el } from './dom.js';

// Fixed offset is safe: Israel is on IDT (UTC+3) on this date.
const EXAM_TS = Date.parse('2026-07-13T09:45:00+03:00');

const HOUR = 3600e3;
const DAY = 24 * HOUR;

const TITLES = {
  far: '☠️ THE FINAL EXAM APPROACHES ☠️',
  day: '⏰ LESS THAN A DAY REMAINS ⏰',
  hour: '🚨 IT IS ALMOST TIME 🚨',
  go: "🍀 IT'S TIME. GO GET IT.",
};

const pad2 = (n) => String(n).padStart(2, '0');

// Self-starting doom countdown to the exam; returns the node with stop().
export function examCountdown() {
  const seg = (unit) => {
    const num = el('span', { class: 'doom-num' }, '--');
    const wrap = el('span', { class: 'doom-seg' }, num, el('span', { class: 'doom-unit' }, unit));
    return { wrap, num };
  };
  const days = seg('days');
  const hours = seg('hours');
  const mins = seg('min');
  const secs = seg('sec');
  const daySep = el('span', { class: 'doom-sep' }, ':');

  const title = el('div', { class: 'doom-title' });
  const digits = el('div', { class: 'doom-digits', 'aria-hidden': 'true' },
    days.wrap, daySep,
    hours.wrap, el('span', { class: 'doom-sep' }, ':'),
    mins.wrap, el('span', { class: 'doom-sep' }, ':'),
    secs.wrap,
  );
  const when = el('div', { class: 'doom-when' }, 'Monday 13.7 · 09:45 (Israel time)');
  const root = el('div', { class: 'doom-countdown', role: 'timer', 'aria-label': 'Time until the exam' },
    title, digits, when);

  let interval = null;
  root.stop = () => {
    if (interval) clearInterval(interval);
    interval = null;
  };

  const tick = () => {
    const left = EXAM_TS - Date.now();
    const tier = left <= 0 ? 'go' : left <= HOUR ? 'hour' : left <= DAY ? 'day' : 'far';
    if (root.dataset.tier !== tier) {
      root.dataset.tier = tier;
      title.textContent = TITLES[tier];
    }
    if (tier === 'go') {
      when.textContent = 'Good luck — you built the streak for this. 🔥';
      root.stop();
      return;
    }
    const s = Math.floor(left / 1000);
    days.num.textContent = String(Math.floor(s / 86400));
    hours.num.textContent = pad2(Math.floor(s / 3600) % 24);
    mins.num.textContent = pad2(Math.floor(s / 60) % 60);
    secs.num.textContent = pad2(s % 60);
    const showDays = s >= 86400;
    days.wrap.hidden = !showDays;
    daySep.hidden = !showDays;
  };

  tick();
  interval = setInterval(tick, 500);
  return root;
}
