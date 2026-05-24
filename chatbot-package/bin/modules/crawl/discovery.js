import fs from "node:fs/promises";
import path from "node:path";
import { CODE_EXTENSIONS, CONTENT_EXTENSIONS, IGNORE_DIRS, LOCALE_EXTENSIONS, toPosix } from "./shared.js";

const isGeneratedBuildPath = (absPath) => {
  const p = toPosix(absPath);
  return (
    /\/\.next(?:\/|$)/.test(p) ||
    /\/\.next[_-][^/]+/.test(p) ||
    /\/\.turbopack(?:\/|$)/.test(p) ||
    /\/(?:out|build|dist)(?:\/|$)/.test(p) ||
    /\/(?:server|dev)\/(?:static|chunks|vendor-chunks)\//.test(p) ||
    /hot-update\.(js|json)$/.test(p) ||
    /webpack\.[a-f0-9]+\.hot-update\.js$/.test(p) ||
    /\/node_modules\//.test(p)
  );
};

export const walkFiles = async (rootDir, includeTests) => {
  const out = [];
  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (isGeneratedBuildPath(abs)) continue;
      if (entry.isDirectory()) {
        const generatedBuildDir =
          entry.name.startsWith(".next") ||
          entry.name.startsWith("next-") ||
          entry.name.endsWith(".next") ||
          /^\.next[_-]/.test(entry.name) ||
          /^\.turbopack/.test(entry.name);

        if (generatedBuildDir) continue;
        if (IGNORE_DIRS.has(entry.name)) continue;
        if (!includeTests && /(^|[-_.])(test|tests|__tests__)([-_.]|$)/i.test(entry.name)) continue;
        stack.push(abs);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      const localeLikePath = /(^|\/)(locales?|i18n|intl|messages?|translations?)\//i.test(abs);
      const isLocaleData = LOCALE_EXTENSIONS.has(ext) && localeLikePath;
      if (!CODE_EXTENSIONS.has(ext) && !CONTENT_EXTENSIONS.has(ext) && !isLocaleData) continue;
      if (!includeTests && /(\.test|\.spec)\.[tj]sx?$/i.test(entry.name)) continue;
      out.push(abs);
    }
  }

  return out;
};
