import { on } from '../utils/dom';

export function mount(el: HTMLElement): void {
  const ac = new AbortController();
  const { signal } = ac;

  let lastScrollY = window.scrollY;
  let ticking = false;

  // Publish the rendered header height so sticky elements below it (e.g. the
  // missing-scientists TOC) can offset themselves without a hardcoded magic
  // number. The header is now two rows (brand bar + dossier bar) and its
  // height shifts with viewport width and font swap, so measure it live.
  // CSS carries a static fallback for the pre-hydration / no-JS case.
  function publishHeaderHeight(): void {
    document.documentElement.style.setProperty(
      '--site-header-height',
      `${el.offsetHeight}px`,
    );
  }

  publishHeaderHeight();
  // Fraunces swaps in after first paint and can nudge the brand row height.
  document.fonts?.ready.then(publishHeaderHeight).catch(() => {});

  let resizeTicking = false;
  on(window, 'resize', () => {
    if (resizeTicking) return;
    resizeTicking = true;
    requestAnimationFrame(() => {
      publishHeaderHeight();
      resizeTicking = false;
    });
  }, { signal, passive: true });

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
