# Phase 3 — CSS Architecture

**Owner subagent:** `css-specialist`

---

## Task: Implement the complete CSS system using native modern CSS

All CSS uses native features only. NO Sass, NO PostCSS, NO CSS-in-JS. Use native nesting, @layer, custom properties, oklch(), color-mix(), container queries, :has(), and logical properties throughout.

### src/styles/main.css
- Declare cascade layers: @layer reset, tokens, typography, layout, components, animations, utilities;
- @import each CSS file into its appropriate layer:
  @import './reset.css' layer(reset);
  @import './tokens.css' layer(tokens);
  etc.

### src/styles/reset.css
- Modern CSS reset (Andy Bell / Josh Comeau style)
- *, *::before, *::after { box-sizing: border-box }
- Remove default margins on body, headings, p, figure, blockquote
- html { text-size-adjust: 100% }
- img, picture, video, canvas, svg { display: block; max-inline-size: 100% }
- input, button, textarea, select { font: inherit }
- Accessible :focus-visible styles with a visible outline

### src/styles/tokens.css
- All design tokens as custom properties on :root
- Color palette using oklch():
  - Light mode defaults: --color-bg (warm white), --color-surface (slightly off), --color-text (near-black), --color-text-muted (mid gray), --color-accent (a distinctive non-generic color — NOT purple gradient), --color-accent-hover, --color-code-bg, --color-border
  - Dark mode via @media (prefers-color-scheme: dark) { :root { ... } } — override same vars
  - Manual toggle support: [data-theme="dark"] { ... } and [data-theme="light"] { ... }
- Type scale using clamp() for fluid sizing:
  - --text-xs, --text-sm, --text-base, --text-lg, --text-xl, --text-2xl, --text-3xl
  - Base around 1rem/16px, scale up ~1.25 ratio
- Font stacks: --font-body (system sans), --font-heading (a distinctive choice loaded via @font-face — NOT Inter, NOT Roboto, NOT Space Grotesk), --font-mono (monospace stack)
- Spacing scale: --space-2xs, --space-xs, --space-sm, --space-md, --space-lg, --space-xl, --space-2xl, --space-3xl
- Border radius: --radius-sm, --radius-md, --radius-lg, --radius-full
- Transitions: --duration-fast (150ms), --duration-normal (300ms), --duration-slow (500ms)
- Container: --container-max (1200px), --container-padding (clamp(1rem, 5vw, 3rem))

### src/styles/typography.css
- @font-face for heading font (choose something distinctive — e.g., a geometric sans, a slab serif, or a humanist font from Google Fonts)
- Body text: font-family var(--font-body), line-height 1.6, color var(--color-text)
- Headings h1-h4 with descending sizes from type scale, tighter line-height (1.2), font-family var(--font-heading)
- .prose class for article content:
  - max-inline-size: 65ch
  - line-height: 1.7
  - Use native nesting for all child elements:
    - p, li: margin-block
    - a: color accent, underline offset, hover transition
    - blockquote: border-inline-start, padding, italic, muted color
    - pre + code: background, padding, border-radius, overflow-x auto, custom scrollbar
    - inline code: background, padding-inline, border-radius, font-size slightly smaller
    - img: border-radius, margin-block
    - ul, ol: padding-inline-start
    - hr: border-color using color-mix()

### src/styles/layout.css
- Body: min-block-size 100dvh, display grid, grid-template-rows: auto 1fr auto (header, main, footer)
- .container: max-inline-size var(--container-max), margin-inline auto, padding-inline var(--container-padding)
- Main content area styling
- Footer: border-block-start, padding, muted text
- Use logical properties everywhere (margin-inline, padding-block, inline-size, block-size)

### src/styles/nav.css
- Desktop: horizontal flex nav with gap
- Nav links: no underline, color transition on hover, subtle active indicator
- Mobile (under 768px): hamburger toggle using a hidden checkbox + label + :has()
  - .nav:has(#nav-toggle:checked) .nav-links { display: flex } — pure CSS toggle, no JS needed
  - Hamburger icon via CSS (three lines using spans or pseudo-elements)
  - Slide-in or fade-in animation on the menu
- .nav--hidden class for scroll-hide behavior (translated up, transition)
- Sticky positioning: position: sticky, top: 0

### src/styles/components.css
- Article card (.card):
  - Wrap in a container query context: container-type: inline-size
  - Default: stacked layout (image top, text below)
  - @container (min-width: 500px): side-by-side grid layout
  - Hover: translateY(-2px), box-shadow increase, transition
  - Title, date, description, tag pills
- Tag pill (.tag):
  - Background using color-mix(in oklch, var(--color-accent) 15%, transparent)
  - Small text, border-radius full, padding-inline
- Project card (.project-card):
  - Similar to article card but with tech stack tags
  - Optional external link icon
- Button (.btn):
  - Padding, border-radius, background accent, color, hover state
  - .btn--outline variant
- Skip-to-content (#skip-link):
  - Visually hidden until focused, then positioned top-left
  - Ensures keyboard users can skip nav

### src/styles/animations.css
- @keyframes definitions: fade-in, slide-up, scale-in
- Scroll-driven animation for elements entering viewport:
  @supports (animation-timeline: view()) {
    [data-reveal] {
      animation: fade-in linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 40%;
    }
  }
- Fallback: without scroll-driven support, elements just appear (opacity: 1 default)
- Page load stagger: .stagger-1 through .stagger-4 with increasing animation-delay
- Hover micro-interactions: scale, shadow, color transitions
- @media (prefers-reduced-motion: reduce):
  - Set all animation-duration to 0.01ms
  - Set all transition-duration to 0.01ms
  - Disable scroll-driven animations

### Critical rules
- Native CSS nesting everywhere
- ALL colors use oklch() or color-mix(in oklch, ...)
- ALL spacing uses custom properties from tokens
- Every rule lives inside a @layer
- :has() for parent-aware styling where it replaces JS
- Progressive enhancement with @supports for newer features
- Mobile-first: base styles for mobile, enhance with container/media queries
- Choose a distinctive, non-generic color palette — this is a portfolio site, it should have personality
