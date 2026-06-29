import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATES_DIR = join(__dirname, "../src/templates");

// Cache loaded templates within a single build run
const templateCache = new Map<string, string>();

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
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    // noUncheckedIndexedAccess: slots[key] is string | undefined
    const val = slots[key];
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
