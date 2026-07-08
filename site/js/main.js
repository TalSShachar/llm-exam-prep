import { loadBank } from './data.js';
import { applyTheme } from './state.js';
import { el } from './components/dom.js';
import * as home from './screens/home.js';
import * as streak from './screens/streak.js';
import * as exam from './screens/exam.js';
import * as stats from './screens/stats.js';
import * as settings from './screens/settings.js';

const SCREENS = { '': home, streak, exam, stats, settings };
const app = document.getElementById('app');
let current = null;
let bank = null;

function route() {
  const name = (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
  const screen = SCREENS[name] ?? home;

  current?.cleanup?.();
  const node = screen.render(bank);
  current = node;
  app.replaceChildren(node);
  window.scrollTo({ top: 0 });

  document.querySelectorAll('.topnav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === name);
  });
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '')) return;
  if (current?.onKey?.(e)) e.preventDefault();
}

async function boot() {
  applyTheme();
  try {
    bank = await loadBank();
  } catch (err) {
    app.replaceChildren(
      el('div', { class: 'card center stack', style: 'margin-top:2rem' },
        el('h2', {}, 'Could not load the question bank'),
        el('p', { class: 'muted' },
          'If you opened index.html directly from disk, serve it instead: ',
          el('code', {}, 'python3 -m http.server -d site 8000')),
        el('p', { class: 'small muted' }, String(err)),
      ),
    );
    return;
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('keydown', onKey);
  route();
}

boot();
