import { readdir, readFile } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

export interface ArticleMeta {
  title: string;
  slug: string;
  date: string;
  tags: string[];
  description: string;
  draft?: boolean;
}

export interface ProjectMeta {
  title: string;
  slug: string;
  description: string;
  tech: string[];
  url?: string;
  github?: string;
  featured?: boolean;
  landing?: string;
  draft?: boolean;
}

export interface ParsedContent<T> {
  meta: T;
  html: string;
  readingTime: number;
}

// Validate that an unknown value has all required string fields
function requireString(data: unknown, key: string, file: string): string {
  if (
    typeof data !== "object" ||
    data === null ||
    !(key in data) ||
    typeof (data as Record<string, unknown>)[key] !== "string"
  ) {
    throw new Error(`[markdown] "${file}" missing required string field: ${key}`);
  }
  return (data as Record<string, string>)[key] as string;
}

function requireStringArray(data: unknown, key: string, file: string): string[] {
  if (typeof data !== "object" || data === null) {
    throw new Error(`[markdown] "${file}" missing required array field: ${key}`);
  }
  const record = data as Record<string, unknown>;
  const val = record[key];
  if (!Array.isArray(val)) {
    throw new Error(`[markdown] "${file}" field "${key}" must be an array`);
  }
  return val.map((item, i) => {
    if (typeof item !== "string") {
      throw new Error(`[markdown] "${file}" field "${key}[${i}]" must be a string`);
    }
    return item;
  });
}

function optionalString(data: unknown, key: string): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const val = (data as Record<string, unknown>)[key];
  return typeof val === "string" ? val : undefined;
}

function optionalBoolean(data: unknown, key: string): boolean | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const val = (data as Record<string, unknown>)[key];
  return typeof val === "boolean" ? val : undefined;
}

function parseArticleMeta(data: unknown, file: string): ArticleMeta {
  const title = requireString(data, "title", file);
  const slug = requireString(data, "slug", file);
  const date = requireString(data, "date", file);
  const tags = requireStringArray(data, "tags", file);
  const description = requireString(data, "description", file);
  const draft = optionalBoolean(data, "draft");
  return { title, slug, date, tags, description, ...(draft !== undefined && { draft }) };
}

function parseProjectMeta(data: unknown, file: string): ProjectMeta {
  const title = requireString(data, "title", file);
  const slug = requireString(data, "slug", file);
  const description = requireString(data, "description", file);
  const tech = requireStringArray(data, "tech", file);
  const url = optionalString(data, "url");
  const github = optionalString(data, "github");
  const featured = optionalBoolean(data, "featured");
  const landing = optionalString(data, "landing");
  const draft = optionalBoolean(data, "draft");
  return {
    title,
    slug,
    description,
    tech,
    ...(url !== undefined && { url }),
    ...(github !== undefined && { github }),
    ...(featured !== undefined && { featured }),
    ...(landing !== undefined && { landing }),
    ...(draft !== undefined && { draft }),
  };
}

export function transformRedacted(html: string): string {
  return html.replaceAll("[REDACTED]", '<span class="redacted">REDACTED</span>');
}

const isProd = process.env["NODE_ENV"] === "production";

async function parseFile<T>(
  filePath: string,
  parseMeta: (data: unknown, file: string) => T,
): Promise<ParsedContent<T>> {
  const raw = await readFile(filePath, "utf-8");
  const parsed = matter(raw);

  const meta = parseMeta(parsed.data, filePath);

  const wordCount = parsed.content.trim().split(/\s+/).filter(Boolean).length;
  const readingTime = Math.ceil(wordCount / 200);

  // marked returns string | Promise<string> depending on version — await handles both
  const html = transformRedacted(String(await marked(parsed.content)));

  return { meta, html, readingTime };
}

// Overloads for common use cases so callers don't need to pass a parser function
export async function parseContentDir(
  dir: string,
  kind: "article",
): Promise<ParsedContent<ArticleMeta>[]>;
export async function parseContentDir(
  dir: string,
  kind: "project",
): Promise<ParsedContent<ProjectMeta>[]>;
export async function parseContentDir<T>(
  dir: string,
  parseMeta: (data: unknown, file: string) => T,
): Promise<ParsedContent<T>[]>;

export async function parseContentDir<T>(
  dir: string,
  kindOrParser:
    | "article"
    | "project"
    | ((data: unknown, file: string) => T),
): Promise<ParsedContent<ArticleMeta | ProjectMeta | T>[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    // Directory doesn't exist yet — return empty, no crash
    return [];
  }

  const mdFiles = entries.filter((e) => extname(e) === ".md");
  if (mdFiles.length === 0) return [];

  const parser =
    kindOrParser === "article"
      ? parseArticleMeta
      : kindOrParser === "project"
        ? parseProjectMeta
        : (kindOrParser as (data: unknown, file: string) => T);

  const results = await Promise.all(
    mdFiles.map((file) => parseFile(join(dir, file), parser as (data: unknown, file: string) => ArticleMeta | ProjectMeta | T)),
  );

  // Filter drafts in production
  const filtered = results.filter((item) => {
    if (!isProd) return true;
    const meta = item.meta as Record<string, unknown>;
    return meta["draft"] !== true;
  });

  // Sort articles by date descending; projects keep file order
  if (kindOrParser === "article") {
    (filtered as ParsedContent<ArticleMeta>[]).sort(
      (a, b) => new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime(),
    );
  }

  return filtered;
}

// Convenience: derive slug from filename if frontmatter lacks one (used internally)
export function slugFromFilename(file: string): string {
  return basename(file, extname(file));
}
