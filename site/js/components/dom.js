// Tiny DOM helpers shared by all screens/components.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

let toastTimer = null;
export function toast(msg, ms = 2200) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const t = el('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  toastTimer = setTimeout(() => {
    t.classList.add('out');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, ms);
}

export function confettiBurst(n = 26) {
  const colors = ['#f59e0b', '#f97316', '#34d399', '#60a5fa', '#f472b6'];
  for (let i = 0; i < n; i++) {
    const bit = el('span', { class: 'confetti-bit' });
    bit.style.background = colors[i % colors.length];
    bit.style.setProperty('--dx', `${(Math.random() - 0.5) * 360}px`);
    bit.style.setProperty('--dy', `${(Math.random() - 0.75) * 380}px`);
    bit.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`);
    bit.style.animationDelay = `${Math.random() * 120}ms`;
    document.body.append(bit);
    bit.addEventListener('animationend', () => bit.remove(), { once: true });
  }
}
