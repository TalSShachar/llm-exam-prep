// site/js/components/duckButton.js
import { el } from './dom.js';
import * as voice from '../voice.js';

// Toggle button that reads `text` aloud in the minion voice. Disables itself
// (and renders pre-disabled) once the speech engine has failed this session.
export function duckButton(text) {
  const btn = el('button', {
    class: 'duck-btn',
    'aria-label': 'Read question aloud',
    title: 'Read question aloud',
  }, '🍌');

  if (voice.isFailed()) fail();
  let busy = false;

  btn.onclick = async () => {
    if (busy || btn.disabled) return;
    if (voice.isSpeaking()) { voice.stop(); return; }
    busy = true;
    btn.classList.add('loading');
    try {
      const started = await voice.speak(text, { onEnd: () => btn.classList.remove('quacking') });
      if (started) btn.classList.add('quacking');
    } catch {
      fail();
    } finally {
      busy = false;
      btn.classList.remove('loading');
    }
  };

  function fail() {
    btn.disabled = true;
    btn.textContent = '🚫';
    btn.title = 'Speech engine unavailable';
    btn.setAttribute('aria-label', 'Read aloud unavailable — speech engine failed to load');
  }

  return btn;
}
