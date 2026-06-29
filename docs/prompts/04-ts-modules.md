# Phase 4 — TypeScript Interactive Modules

**Owner subagent:** `ts-specialist`

---

## Task: Implement client-side TypeScript modules

Small, isolated modules that mount to specific DOM elements. Tree-shakeable. Only included on pages that use them via dynamic import. Modern TS throughout — satisfies, import type, as const, no enums, no any.

### src/ts/utils/dom.ts
Typed DOM helpers — every function small and focused:

- qs<T extends Element>(selector: string, parent: ParentNode = document): T | null
  - Typed querySelector wrapper
- qsa<T extends Element>(selector: string, parent: ParentNode = document): T[]
  - Returns array (not NodeList) via Array.from
- on<K extends keyof HTMLElementEventMap>(
    el: EventTarget,
    event: K,
    handler: (e: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions
  ): () => void
  - Returns cleanup function that removes the listener
- create<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs?: Partial<HTMLElementTagNameMap[K]>,
    children?: (Node | string)[]
  ): HTMLElementTagNameMap[K]
  - Typed element factory

### src/ts/main.ts
- Runs on DOMContentLoaded
- Module registry as const map: { 'theme-toggle': () => import('./modules/theme-toggle.ts'), ... }
- Auto-discovers via: qsa<HTMLElement>('[data-module]')
- For each discovered element, looks up module name in registry, dynamically imports, calls mount(element)
- Errors are caught and logged per-module — one failing module doesn't break others
- Log: "[mount] theme-toggle mounted" in dev

### src/ts/modules/theme-toggle.ts
- On mount: read prefers-color-scheme, check localStorage for 'theme' preference
- Toggle [data-theme] on document.documentElement
- On toggle: briefly add .no-transition class to <html>, change theme, requestAnimationFrame remove class
- Save preference to localStorage
- Button should have appropriate aria-label that updates ("Switch to dark mode" / "Switch to light mode")
- Export: { mount: (el: HTMLElement) => void }

### src/ts/modules/nav.ts
- Show/hide nav on scroll direction:
  - Track lastScrollY
  - On scroll (throttled via requestAnimationFrame): compare current vs last
  - Scroll down > 50px: add .nav--hidden class
  - Scroll up: remove .nav--hidden class
  - At top (scrollY < 100): always show
- CSS handles the actual hide/show via transform + transition
- Use AbortController for cleanup
- Export: { mount: (el: HTMLElement) => void }

### src/ts/modules/scroll-reveal.ts
- Uses IntersectionObserver to add .revealed class when elements enter viewport
- Targets all elements with [data-reveal] attribute
- Configuration via data-reveal value: "fade-up" | "fade-in" | "scale-in"
  - These map to CSS classes .reveal-fade-up, .reveal-fade-in, .reveal-scale-in
- threshold: 0.1, rootMargin: "0px 0px -50px 0px"
- Once revealed, unobserve the element (animate once only)
- Only mounts if browser does NOT support scroll-driven animations:
  if (CSS.supports('animation-timeline', 'view()')) return; // CSS handles it
- Export: { mount: (el: HTMLElement) => void }

### src/ts/modules/carousel.ts
- Pure DOM carousel using CSS scroll-snap
- HTML structure expected:
  <div data-module="carousel">
    <div class="carousel-track"> <!-- scroll-snap-type: x mandatory -->
      <div class="carousel-slide">...</div>
      <div class="carousel-slide">...</div>
    </div>
    <button class="carousel-prev" aria-label="Previous">←</button>
    <button class="carousel-next" aria-label="Next">→</button>
    <div class="carousel-dots"></div>
  </div>
- Scroll track uses CSS scroll-snap-type: x mandatory on track, scroll-snap-align: start on slides
- Prev/next buttons scroll by one slide width using scrollBy({ left, behavior: 'smooth' })
- Dots generated dynamically from slide count
- IntersectionObserver on slides to detect which is active → update active dot
- Keyboard: ArrowLeft/ArrowRight when carousel is focused
- Touch works automatically via native scroll
- Use AbortController for all listener cleanup
- Export: { mount: (el: HTMLElement) => void }

### Critical rules
- Every module exports exactly: { mount: (el: HTMLElement) => void }
- No global state — each module is self-contained with closure scope
- No `any` — type everything
- No type assertions unless genuinely necessary (document with comment why)
- Prefer CSS for visuals, JS only for behavior/state
- Use AbortController for cleanup in every module
- All event listeners use the on() helper from dom.ts
