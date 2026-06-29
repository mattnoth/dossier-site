// This module only mounts when the browser lacks native scroll-driven animation support.
// When `animation-timeline: view()` is supported, animations.css handles [data-reveal]
// entirely in CSS — no JS needed.

import { qsa } from '../utils/dom';

type RevealVariant = 'fade-up' | 'fade-in' | 'scale-in';

// Valid reveal variants — the injected CSS maps each to a keyframe from animations.css.
const VALID_VARIANTS = new Set<RevealVariant>(['fade-up', 'fade-in', 'scale-in']);

// Injected once — reuses keyframes already defined in animations.css.
// Only active in the fallback path (no scroll-driven animation support).
function injectFallbackStyles(): void {
  if (document.getElementById('scroll-reveal-styles')) return;

  const style = document.createElement('style');
  style.id = 'scroll-reveal-styles';
  style.textContent = `
    @media (prefers-reduced-motion: no-preference) {
      [data-reveal].reveal-pending {
        opacity: 0;
      }
      [data-reveal].revealed {
        animation-duration: 500ms;
        animation-fill-mode: both;
        animation-timing-function: ease;
      }
      [data-reveal="fade-up"].revealed  { animation-name: slide-up; }
      [data-reveal="fade-in"].revealed  { animation-name: fade-in; }
      [data-reveal="scale-in"].revealed { animation-name: scale-in; }
    }
    @media (prefers-reduced-motion: reduce) {
      [data-reveal].reveal-pending { opacity: 1; }
    }
  `;
  document.head.append(style);
}

function isRevealVariant(value: string): value is RevealVariant {
  // Cast required: Set<RevealVariant>.has() only accepts RevealVariant, not string.
  // Safe because a non-matching string simply returns false.
  return VALID_VARIANTS.has(value as RevealVariant);
}

export function mount(_el: HTMLElement): void {
  // CSS scroll-driven animations handle this natively — bail out.
  if (CSS.supports('animation-timeline', 'view()')) return;

  if (!('IntersectionObserver' in window)) return;

  injectFallbackStyles();

  const elements = qsa<HTMLElement>('[data-reveal]');

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        // IntersectionObserverEntry.target is typed as Element; we observed HTMLElements only.
        const target = entry.target as HTMLElement;
        target.classList.remove('reveal-pending');
        target.classList.add('revealed');
        observer.unobserve(target);
      }
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' },
  );

  for (const el of elements) {
    const variant = el.dataset['reveal'] ?? '';
    if (!isRevealVariant(variant)) continue;
    el.classList.add('reveal-pending');
    observer.observe(el);
  }
}
