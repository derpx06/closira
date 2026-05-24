import path from "node:path";
import { CONTENT_EXTENSIONS, toPosix, toRoute } from "./shared.js";

export const classifyPath = (relativePath) => {
  const rel = toPosix(relativePath);
  const ext = path.extname(rel).toLowerCase();

  if (/^app\/api\/.+\/route\.[tj]sx?$/i.test(rel)) return "api-app-router";
  if (/^pages\/api\/.+\.[tj]sx?$/i.test(rel)) return "api-pages-router";
  if (/^app\/.+\/page\.[tj]sx?$/i.test(rel) || /^app\/page\.[tj]sx?$/i.test(rel)) return "page-app-router";
  if (/^pages\/.+\.[tj]sx?$/i.test(rel) && !/^pages\/api\//i.test(rel)) return "page-pages-router";
  if (/^components\/.+\.[tj]sx?$/i.test(rel)) return "component";
  if (/(^|\/)(locales?|i18n|intl|messages?|translations?)\/.+\.json$/i.test(rel)) return "locale";
  if (CONTENT_EXTENSIONS.has(ext)) return "content";
  if (/^(lib|config|constants|data)\//i.test(rel)) return "config";
  return "other-code";
};

export const extractRouteFromFile = (relativePath, kind) => {
  const rel = toPosix(relativePath);
  const seg = rel.split("/");

  if (kind === "api-app-router") {
    const after = seg.slice(2, -1);
    return `/api${toRoute(after) === "/" ? "" : toRoute(after)}`;
  }

  if (kind === "api-pages-router") {
    const withoutExt = rel.replace(/\.[^.]+$/, "");
    const after = withoutExt.split("/").slice(2);
    return `/api${toRoute(after) === "/" ? "" : toRoute(after)}`;
  }

  if (kind === "page-app-router") {
    const after = seg.slice(1, -1);
    return toRoute(after);
  }

  if (kind === "page-pages-router") {
    const withoutExt = rel.replace(/\.[^.]+$/, "");
    const after = withoutExt.split("/").slice(1);
    if (["_app", "_document", "_error"].includes(after[0])) return null;
    return toRoute(after);
  }

  return null;
};
