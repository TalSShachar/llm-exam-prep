import { el } from './dom.js';
import { streakTier } from '../engine.js';

// Streak meter: flame + counter. Call .set(n, {pop}) to update.
export function streakFlame(label = 'streak') {
  const flame = el('span', { class: 'flame', 'aria-hidden': 'true' }, '🔥');
  const count = el('span', { class: 'streak-count' }, '0');
  const root = el(
    'div',
    { class: 'streak-meter', dataset: { tier: '0' }, role: 'status', 'aria-label': label },
    flame,
    el('div', {},
      count,
      el('div', { class: 'streak-label' }, label),
    ),
  );
  root.set = (n, { pop = false } = {}) => {
    count.textContent = String(n);
    root.dataset.tier = String(streakTier(n));
    if (pop) {
      count.classList.remove('pop');
      void count.offsetWidth; // restart animation
      count.classList.add('pop');
    }
  };
  return root;
}

// Ember-fall effect on streak reset, anchored to a container.
export function dropEmbers(container, n = 7) {
  const wrap = el('div', { class: 'embers', 'aria-hidden': 'true' });
  for (let i = 0; i < n; i++) {
    const e = el('span', { class: 'ember' }, '🔥');
    e.style.left = `${8 + Math.random() * 84}%`;
    e.style.top = `${Math.random() * 30}%`;
    e.style.animationDelay = `${Math.random() * 180}ms`;
    e.style.fontSize = `${0.6 + Math.random() * 0.7}rem`;
    wrap.append(e);
  }
  container.append(wrap);
  setTimeout(() => wrap.remove(), 1400);
}
