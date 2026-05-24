import path from "node:path";

export const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
export const CONTENT_EXTENSIONS = new Set([".md", ".mdx"]);
export const LOCALE_EXTENSIONS = new Set([".json"]);

export const IGNORE_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "coverage",
  ".turbo",
  ".cache",
  "out",
  "build",
  "supporthub-output",
]);

export const toPosix = (value) => value.split(path.sep).join("/");
export const uniq = (arr) => [...new Set(arr)];

export const normalizeDynamicSegment = (segment) => {
  if (/^\[\[\.\.\.(.+)\]\]$/.test(segment)) return "*";
  if (/^\[\.\.\.(.+)\]$/.test(segment)) return "*";
  if (/^\[(.+)\]$/.test(segment)) return `:${segment.slice(1, -1)}`;
  return segment;
};

export const toRoute = (segments) => {
  const clean = segments
    .filter(Boolean)
    .filter((part) => !part.startsWith("(") && !part.endsWith(")"))
    .filter((part) => !part.startsWith("@"))
    .map((part) => normalizeDynamicSegment(part))
    .filter((part) => !["page", "route", "index"].includes(part));

  return clean.length ? `/${clean.join("/")}` : "/";
};
