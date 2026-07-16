// build/site.config.ts
// Single source of truth for site-wide branding, origin, and routing.
//
// Everything that used to be hardcoded to the personal site (mattnoth.dev,
// "Matt Noth", the /projects/missing-scientists/ subpath) now lives here so the
// dossier can be re-skinned or re-domained without touching the generator.

/**
 * Canonical origin for the deployed site. Used for canonical URLs, OG tags,
 * JSON-LD, sitemap, and robots.txt.
 *
 * The final domain is TBD — ship first on the Netlify *.netlify.app URL.
 * Override at build time with SITE_ORIGIN=https://example.com.
 */
export const SITE_ORIGIN =
  process.env["SITE_ORIGIN"]?.replace(/\/$/, "") ?? "https://dossier-site.netlify.app";

/** Umbrella publication identity (Tier-1 brand chrome).
 *  The site hosts multiple dossiers; "Missing Scientists" is one of them.
 *  WORKING TITLE — swap the string here when the real name is settled. */
export const brandName = "Anomaly Dossiers";
export const brandTagline =
  "Structured, evidence-based investigations into unexplained deaths, disappearances, and anomalies.";

/** Primary-dossier identity. Retained as top-level exports because the default
 *  OG image (build/generate-images.ts) still renders this name. The dossier
 *  registry below is the source of truth for per-dossier routing + chrome. */
export const siteName = "The Missing Scientists";
export const tagline =
  "A structured, evidence-based research dossier on deaths and disappearances of U.S. defense and advanced-research scientists.";
export const author = "The Missing Scientists Project";

// ── Dossier registry ────────────────────────────────────────────────────
//
// Each dossier is generated into its own namespaced subtree (`base`). Tier-1
// chrome (brand bar, Methodology, About) is shared across all of them and lives
// at the site root; Tier-2 chrome (the dossier bar: label + `sections`) is
// per-dossier. To add a dossier, append an entry here — the generator loops the
// registry and the umbrella directory lists it automatically.

/** A section within a dossier's Tier-2 nav. `path` is relative to the dossier
 *  `base`; "/" is the dossier overview. */
export interface DossierSection {
  readonly path: string;
  readonly label: string;
}

export interface Dossier {
  /** Stable id; also the output-dir slug and the dossier `base` segment. */
  readonly id: string;
  /** Root path served from, e.g. "/missing-scientists". No trailing slash;
   *  "" means the dossier is served at the site root (single-dossier mode). */
  readonly base: string;
  /** Short label for the Tier-2 dossier bar and the directory card heading. */
  readonly label: string;
  /** Full name — page <title> suffix and og:site_name. */
  readonly name: string;
  /** One-line tagline (directory card + meta description fallback). */
  readonly tagline: string;
  /** Longer blurb for the umbrella directory card. */
  readonly blurb: string;
  /** Status line for the directory card, e.g. "11 cases · 2022–2026". */
  readonly status: string;
  /** Byline for JSON-LD author/publisher. */
  readonly author: string;
  /** Tier-2 section nav, in display order. */
  readonly sections: readonly DossierSection[];
  /** Research source dir, relative to build/. */
  readonly researchPath: string;
  /** Optional env var that overrides researchPath at build time. */
  readonly researchDirEnv?: string;
}

const MISSING_SCIENTISTS: Dossier = {
  id: "missing-scientists",
  base: "/missing-scientists",
  label: "Missing Scientists",
  name: siteName,
  tagline,
  blurb:
    "Deaths and disappearances of U.S. defense and advanced-research scientists, 2022–2026. Eleven cases compiled from public sources with source tiering, confidence ratings, and cross-case analysis.",
  status: "11 cases · 2022–2026",
  author,
  sections: [
    { path: "/", label: "Overview" },
    { path: "/diagram/", label: "Diagram" },
    { path: "/timeline/", label: "Timeline" },
    { path: "/analysis/connections/", label: "Connections" },
    { path: "/analysis/hypotheses/", label: "Hypotheses" },
    { path: "/analysis/foreign-intel/", label: "Foreign Intel" },
    { path: "/sources/", label: "Sources" },
  ],
  researchPath: "../research",
  researchDirEnv: "MS_RESEARCH_DIR",
};

export const dossiers: readonly Dossier[] = [MISSING_SCIENTISTS] as const;

/** The dossier whose research repo backs the shared Methodology + About pages.
 *  Those pages are Tier-1 (identical across dossiers) but are sourced from a
 *  real research repo; the primary dossier supplies them. */
export const primaryDossier: Dossier = MISSING_SCIENTISTS;

/** Outbound social / source links rendered in the footer. */
export interface SocialLink {
  readonly label: string;
  readonly href: string;
}
export const social: readonly SocialLink[] = [
  { label: "Research repo", href: "https://github.com/mattnoth/research-missing-scientists" },
] as const;

/** Footer contact / colophon line (kept generic — no personal email). */
export const footerNote =
  "An independent, AI-assisted research project. All sourcing is public material.";

/** Accent color identity (the CSS skin owns the real values; this is for image generation + reference). */
export const accent = "#3ddc84"; // terminal green

/** OG/social-share image path (generated by build/generate-images.ts). */
export const OG_IMAGE_PATH = "/assets/images/og-default.png";

/** Robots policy for content pages. Held at noindex while the site ships under a
 *  working-title *.netlify.app name: indexing a placeholder URL would strand
 *  search results that a later rename can only fix with redirects. Flip to
 *  "index, follow" once the final name and domain are settled. */
export const ROBOTS = "noindex, nofollow";
