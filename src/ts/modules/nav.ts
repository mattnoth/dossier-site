import { on } from '../utils/dom';

export function mount(el: HTMLElement): void {
  const ac = new AbortController();
  const { signal } = ac;

  let lastScrollY = window.scrollY;
  let ticking = false;

  function update(): void {
    const currentY = window.scrollY;

    if (currentY < 100) {
      // Always show near top of page.
      el.classList.remove('nav--hidden');
    } else if (currentY > lastScrollY + 50) {
      // Scrolled down more than 50px from last position — hide nav.
      el.classList.add('nav--hidden');
    } else if (currentY < lastScrollY) {
      // Scrolling up — show nav.
      el.classList.remove('nav--hidden');
    }

    lastScrollY = currentY;
    ticking = false;
  }

  on(window, 'scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { signal, passive: true });
}
