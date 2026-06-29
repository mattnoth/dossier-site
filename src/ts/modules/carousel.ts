import { qs, qsa, on, create } from '../utils/dom';

// Injects minimal carousel styles once — the CSS file doesn't define carousel classes
// (added in Phase 4), so we own them here alongside the module that needs them.
function injectStyles(): void {
  if (document.getElementById('carousel-styles')) return;

  const style = document.createElement('style');
  style.id = 'carousel-styles';
  style.textContent = `
    .carousel-track {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .carousel-track::-webkit-scrollbar { display: none; }
    .carousel-slide {
      flex: 0 0 100%;
      scroll-snap-align: start;
    }
    .carousel-dots {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-block-start: 0.75rem;
    }
    .carousel-dot {
      inline-size: 0.5rem;
      block-size: 0.5rem;
      border-radius: 9999px;
      border: none;
      background-color: var(--color-border);
      cursor: pointer;
      padding: 0;
      transition: background-color 150ms ease, transform 150ms ease;
    }
    .carousel-dot[aria-current="true"] {
      background-color: var(--color-accent);
      transform: scale(1.3);
    }
    @media (prefers-reduced-motion: reduce) {
      .carousel-track { scroll-behavior: auto; }
      .carousel-dot { transition: none; }
    }
  `;
  document.head.append(style);
}

export function mount(el: HTMLElement): void {
  const trackOrNull = qs<HTMLElement>('.carousel-track', el);
  if (!trackOrNull) return;
  // Narrowed to HTMLElement by the guard above; shadow as const so closures see the narrowed type.
  const track: HTMLElement = trackOrNull;

  const slides = qsa<HTMLElement>('.carousel-slide', el);
  if (slides.length === 0) return;

  injectStyles();

  const ac = new AbortController();
  const { signal } = ac;

  // Buttons may already be in HTML or we create them.
  const prevBtn = qs<HTMLButtonElement>('.carousel-prev', el)
    ?? el.appendChild(create('button', { className: 'carousel-prev', ariaLabel: 'Previous' }, ['←']));
  const nextBtn = qs<HTMLButtonElement>('.carousel-next', el)
    ?? el.appendChild(create('button', { className: 'carousel-next', ariaLabel: 'Next' }, ['→']));

  // Generate dots.
  const dotsContainer = qs<HTMLElement>('.carousel-dots', el)
    ?? el.appendChild(create('div', { className: 'carousel-dots' }));
  dotsContainer.innerHTML = '';

  const dots = slides.map((_, i) => {
    const dot = create('button', {
      className: 'carousel-dot',
      ariaLabel: `Go to slide ${i + 1}`,
    });
    dot.setAttribute('aria-current', i === 0 ? 'true' : 'false');
    dotsContainer.append(dot);
    return dot;
  });

  function slideWidth(): number {
    return track.clientWidth;
  }

  function setActiveDot(index: number): void {
    for (const [i, dot] of dots.entries()) {
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    }
  }

  // Track active slide via IntersectionObserver — more reliable than scroll events.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const index = slides.indexOf(entry.target as HTMLElement);
        if (index !== -1) setActiveDot(index);
      }
    },
    { root: track, threshold: 0.5 },
  );

  for (const slide of slides) observer.observe(slide);

  on(prevBtn, 'click', () => {
    track.scrollBy({ left: -slideWidth(), behavior: 'smooth' });
  }, { signal });

  on(nextBtn, 'click', () => {
    track.scrollBy({ left: slideWidth(), behavior: 'smooth' });
  }, { signal });

  // Dot click — scroll to the corresponding slide.
  for (const [i, dot] of dots.entries()) {
    on(dot, 'click', () => {
      track.scrollTo({ left: i * slideWidth(), behavior: 'smooth' });
    }, { signal });
  }

  // Keyboard navigation when the carousel container is focused.
  el.setAttribute('tabindex', el.getAttribute('tabindex') ?? '0');
  on(el, 'keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      track.scrollBy({ left: -slideWidth(), behavior: 'smooth' });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      track.scrollBy({ left: slideWidth(), behavior: 'smooth' });
    }
  }, { signal });

  signal.addEventListener('abort', () => observer.disconnect());
}
