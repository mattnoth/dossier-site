import { on } from '../utils/dom';

type Theme = 'light' | 'dark';

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem('theme');
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function applyTheme(theme: Theme, button: HTMLElement): void {
  const html = document.documentElement;

  // Inline style override instead of a CSS class — suppresses all transitions during the
  // color token swap. rAF removes it after the browser has painted the new theme.
  // (The CSS file doesn't define a .no-transition class, so we drive this inline.)
  html.style.setProperty('transition', 'none');
  html.setAttribute('data-theme', theme);
  button.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
  );

  requestAnimationFrame(() => {
    html.style.removeProperty('transition');
  });
}

export function mount(el: HTMLElement): void {
  const button = el instanceof HTMLButtonElement ? el : el.querySelector('button');
  if (!button) return;

  const ac = new AbortController();
  const { signal } = ac;

  const currentTheme: Theme = getStoredTheme() ?? 'dark';
  applyTheme(currentTheme, button);

  on(button, 'click', () => {
    // getAttribute returns string | null; we treat unexpected values as non-dark → next = 'light'.
    const current = document.documentElement.getAttribute('data-theme') as Theme | null;
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    applyTheme(next, button);
    localStorage.setItem('theme', next);
  }, { signal });
}
