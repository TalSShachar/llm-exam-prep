import { el } from './dom.js';

const R = 18;
const CIRC = 2 * Math.PI * R;

// SVG countdown ring. start() begins the countdown; returns a handle with stop().
export function timerRing(seconds, onExpire) {
  const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const svg = el('div');
  svg.innerHTML =
    `<svg width="44" height="44" viewBox="0 0 44 44">
       <circle class="ring-bg" cx="22" cy="22" r="${R}" fill="none" stroke-width="4"/>
       <circle class="ring-fg" cx="22" cy="22" r="${R}" fill="none" stroke-width="4"
               stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
     </svg>`;
  const num = el('span', { class: 'ring-num' }, String(seconds));
  const root = el('div', { class: 'timer-ring', role: 'timer' }, svg.firstElementChild, num);
  const fgEl = root.querySelector('.ring-fg');

  let raf = null;
  let done = false;
  root.start = () => {
    const t0 = performance.now();
    const tick = (t) => {
      const left = Math.max(0, seconds - (t - t0) / 1000);
      fgEl.style.strokeDashoffset = String(CIRC * (1 - left / seconds));
      num.textContent = String(Math.ceil(left));
      root.classList.toggle('low', left <= Math.min(5, seconds / 3));
      if (left <= 0) {
        if (!done) { done = true; onExpire?.(); }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  root.stop = () => {
    done = true;
    if (raf) cancelAnimationFrame(raf);
  };
  return root;
}
