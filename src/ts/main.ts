import { qsa } from './utils/dom';

// Registry of all interactive modules. Keys match the data-module attribute value.
// Dynamic imports are tree-shaken — only modules used on the page get loaded.
const moduleRegistry = {
  'theme-toggle': () => import('./modules/theme-toggle'),
  'nav':          () => import('./modules/nav'),
  'scroll-reveal': () => import('./modules/scroll-reveal'),
  'carousel':     () => import('./modules/carousel'),
  'ms-diagram':   () => import('./modules/ms-diagram'),
  'ms-timeline':  () => import('./modules/ms-timeline'),
} as const satisfies Record<string, () => Promise<{ mount: (el: HTMLElement) => void }>>;

type ModuleName = keyof typeof moduleRegistry;

// localhost or 127.0.0.1 → treat as dev. No esbuild define needed.
const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

async function mountModules(): Promise<void> {
  const elements = qsa<HTMLElement>('[data-module]');

  for (const el of elements) {
    const name = el.dataset['module'];
    if (name === undefined) continue;

    if (!(name in moduleRegistry)) {
      console.warn(`[mount] unknown module: "${name}"`);
      continue;
    }

    try {
      const mod = await moduleRegistry[name as ModuleName]();
      mod.mount(el);
      if (isDev) {
        console.log(`[mount] ${name} mounted`);
      }
    } catch (err) {
      // Isolate per-module failures — one broken module must not block others.
      console.error(`[mount] ${name} failed:`, err);
    }
  }
}

// Delegated click handler for .redacted censor bars.
// CSS handles hover-reveal; this adds a "peek" animation on click
// (adds .redacted--peeking, removes it when the 600ms keyframe ends).
document.addEventListener('click', (e) => {
  const target = (e.target as Element).closest('.redacted');
  if (!(target instanceof HTMLElement)) return;
  if (target.classList.contains('redacted--peeking')) return;

  target.classList.add('redacted--peeking');
  target.addEventListener('animationend', () => {
    target.classList.remove('redacted--peeking');
  }, { once: true });
});

document.addEventListener('DOMContentLoaded', () => {
  void mountModules();
});
