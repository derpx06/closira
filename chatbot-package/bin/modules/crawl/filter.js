import path from "node:path";

const LOW_SIGNAL_FILENAMES = new Set([
  "eslint.config.js",
  "vite.config.ts",
  "next.config.js",
  "next.config.mjs",
  "postcss.config.js",
  "tailwind.config.js",
  "jest.config.js",
  "vitest.config.ts",
]);

const isLikelyHumanText = (line) => {
  if (!line) return false;
  if (line.length < 8) return false;
  if (line.length > 180) return false;
  if (/^[./@#\w-]+\.[A-Za-z0-9]+$/.test(line)) return false;
  if (/^https?:\/\//i.test(line)) return false;
  if (/^[\w-]+(?:\s[\w-]+){0,2}$/.test(line) && line.length < 14) return false;
  if (/[{}()[\];<>]/.test(line) && !/[A-Za-z]{3,}/.test(line)) return false;
  if (/^(use client|use server)$/i.test(line)) return false;
  if (/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/i.test(line)) return false;
  if (/^(import|export)\s/.test(line)) return false;
  if (/^[A-Za-z0-9_]+\s*[:=]\s*[{[(]/.test(line)) return false;
  if (/^["'`].*["'`]$/.test(line) && !/\s/.test(line)) return false;
  if (/^[A-Za-z0-9_./:-]+$/.test(line) && !/\s/.test(line)) return false;
  return /[A-Za-z]{3,}/.test(line);
};

export const filterUsefulSnippets = (snippets) => snippets.filter((x) => isLikelyHumanText(x));

export const shouldKeepFile = ({ relativePath, kind, textCount, callCount, hasRoute, apiMethodCount, envKeyCount }) => {
  const base = path.basename(relativePath);
  const rel = relativePath.toLowerCase();
  const reasons = [];
  let score = 0;

  if (LOW_SIGNAL_FILENAMES.has(base)) {
    reasons.push("low-signal-config-file");
    score -= 3;
  }

  if (kind.startsWith("api")) score += 6;
  if (kind.startsWith("page")) score += 5;
  if (kind === "content") score += 4;
  if (kind === "component") score += 2;
  if (kind === "config") score += 2;
  if (hasRoute) score += 3;
  if (apiMethodCount > 0) score += 3;
  if (callCount > 0) score += 2;
  if (textCount > 0) score += 2;
  if (envKeyCount > 0) score += 1;

  const hasCriticalNameHint =
    /(api|route|page|controller|service|actions?|handler|webhook|auth|billing|order|profile|support)/.test(rel);

  const keep =
    score >= 2 ||
    kind.startsWith("api") ||
    kind.startsWith("page") ||
    kind === "content" ||
    callCount > 0 ||
    envKeyCount > 0 ||
    hasCriticalNameHint;
  if (!keep && reasons.length === 0) reasons.push("insufficient-signal");

  return { keep, score, reasons };
};

export const shouldKeepOtherCode = ({ callCount, envKeyCount, serverActionCount, i18nUsageCount, textCount }) => {
  if (serverActionCount > 0) return true;
  if (i18nUsageCount > 0) return true;
  if (callCount > 0) return true;
  if (envKeyCount > 0) return true;
  if (textCount >= 6) return true;
  return false;
};
