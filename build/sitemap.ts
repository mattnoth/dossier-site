import { readdir, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join, relative, sep } from "node:path";
import { SITE_ORIGIN } from "./site.config.ts";
import { DIST_DIR } from "./copy-assets.ts";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(path: string): string {
  const loc = escapeXml(`${SITE_ORIGIN}${path}`);
  return `  <url>\n    <loc>${loc}</loc>\n  </url>`;
}

/** Recursively collect every directory that contains an index.html, mapped to a clean route. */
async function collectRoutes(dir: string): Promise<string[]> {
  const routes: string[] = [];
  let entries: Dirent<string>[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return routes;
  }

  if (entries.some((e) => e.isFile() && e.name === "index.html")) {
    const rel = relative(DIST_DIR, dir).split(sep).join("/");
    routes.push(rel === "" ? "/" : `/${rel}/`);
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      routes.push(...(await collectRoutes(join(dir, entry.name))));
    }
  }
  return routes;
}

export async function generateSitemap(): Promise<void> {
  const routes = (await collectRoutes(DIST_DIR)).sort((a, b) => a.localeCompare(b));

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...routes.map(urlEntry),
    `</urlset>`,
  ].join("\n");

  await writeFile(join(DIST_DIR, "sitemap.xml"), xml, "utf-8");

  const robots = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
  await writeFile(join(DIST_DIR, "robots.txt"), robots, "utf-8");

  console.log(`[sitemap] wrote sitemap.xml (${routes.length} urls) + robots.txt`);
}
