// Typed DOM helpers. Thin wrappers — zero runtime overhead beyond the underlying browser APIs.

export function qs<T extends Element>(
  selector: string,
  parent: ParentNode = document,
): T | null {
  return parent.querySelector<T>(selector);
}

export function qsa<T extends Element>(
  selector: string,
  parent: ParentNode = document,
): T[] {
  return Array.from(parent.querySelectorAll<T>(selector));
}

// Returns a cleanup function that removes the listener — pass to AbortController or call directly.
// The `handler as EventListener` cast is required because HTMLElementEventMap[K] is not
// directly assignable to the EventListener overload that addEventListener expects internally.
// Call sites remain fully typed; this cast is entirely internal.
export function on<K extends keyof HTMLElementEventMap>(
  el: EventTarget,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  el.addEventListener(event, handler as EventListener, options);
  return () => el.removeEventListener(event, handler as EventListener, options);
}

export function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Partial<HTMLElementTagNameMap[K]>,
  children?: (Node | string)[],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      // Object.assign handles both properties and reflected attributes cleanly.
      // Type-casting through unknown because Object.entries loses key specificity.
      (el as Record<string, unknown>)[key] = value;
    }
  }
  if (children) {
    for (const child of children) {
      el.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  return el;
}
