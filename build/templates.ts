import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATES_DIR = join(__dirname, "../src/templates");

// Cache loaded templates within a single build run
const templateCache = new Map<string, string>();

// Slots available to every template without being threaded through each page's
// call site — currently the content-hashed asset hrefs, which are only known
// after CSS/JS are emitted. Page slots win on key collision.
let globalSlots: Record<string, string> = {};

/** Register slots injected into every rendered template. Call before generating pages. */
export function setGlobalSlots(slots: Record<string, string>): void {
  globalSlots = { ...globalSlots, ...slots };
}

async function loadTemplate(name: string): Promise<string | null> {
  const cached = templateCache.get(name);
  if (cached !== undefined) return cached;

  const filePath = join(TEMPLATES_DIR, name);
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return null;
  }

  templateCache.set(name, content);
  return content;
}

function applySlots(template: string, slots: Record<string, string>): string {
  const merged = { ...globalSlots, ...slots };
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    // noUncheckedIndexedAccess: merged[key] is string | undefined
    const val = merged[key];
    return val !== undefined ? val : match;
  });
}

/**
 * Render a single template with slot substitution.
 * Returns null if the template file doesn't exist or is a comment-only stub.
 */
export async function renderTemplate(
  templateName: string,
  slots: Record<string, string>,
): Promise<string | null> {
  const raw = await loadTemplate(templateName);
  if (raw === null) return null;

  // Treat comment-only stubs (Phase 1 placeholders) as non-existent
  const trimmed = raw.trim();
  if (trimmed.startsWith("<!--") && !trimmed.includes("{{")) return null;

  return applySlots(raw, slots);
}

/**
 * Render a template and wrap it inside base.html's {{content}} slot.
 * If base.html is a stub, returns the inner content unwrapped.
 * If the inner template is a stub, returns null.
 */
export async function renderPage(
  templateName: string,
  slots: Record<string, string>,
): Promise<string | null> {
  const innerHtml = await renderTemplate(templateName, slots);
  if (innerHtml === null) return null;

  const baseHtml = await loadTemplate("base.html");
  if (baseHtml === null) return innerHtml;

  const baseTrimmed = baseHtml.trim();
  if (baseTrimmed.startsWith("<!--") && !baseTrimmed.includes("{{")) {
    // base.html is a stub — return inner unwrapped
    return innerHtml;
  }

  return applySlots(baseHtml, { ...slots, content: innerHtml });
}

/** Clear the in-memory cache — call between dev-server rebuilds */
export function clearTemplateCache(): void {
  templateCache.clear();
}
