import path from "node:path";
import { uniq } from "./shared.js";

const detectLocaleCode = (file) => {
  const base = path.basename(file).replace(/\.json$/i, "");
  if (/^[a-z]{2}(-[A-Z]{2})?$/.test(base)) return base;
  const parts = file.split("/");
  for (const p of parts) {
    if (/^[a-z]{2}(-[A-Z]{2})?$/.test(p)) return p;
  }
  return "unknown";
};

export const buildI18nMap = ({ usages, localeFiles }) => {
  const localeEntries = localeFiles.flatMap((f) =>
    f.entries.map((e) => ({ file: f.file, locale: detectLocaleCode(f.file), key: e.key, value: e.value })),
  );
  const localeKeys = uniq(localeEntries.map((e) => e.key));
  const usageKeys = uniq(usages.map((u) => u.key));

  const missingInLocales = usageKeys.filter((k) => !localeKeys.includes(k));
  const unusedLocaleKeys = localeKeys.filter((k) => !usageKeys.includes(k));

  const perKeyCoverage = usageKeys.map((key) => ({
    key,
    usedInFiles: usages.filter((u) => u.key === key).map((u) => u.file),
    localesFound: uniq(localeEntries.filter((e) => e.key === key).map((e) => e.locale)),
  }));

  return {
    usages,
    localeFiles: localeFiles.map((x) => ({
      file: x.file,
      locale: detectLocaleCode(x.file),
      entryCount: x.entries.length,
      parseError: x.parseError,
    })),
    coverage: {
      usageKeyCount: usageKeys.length,
      localeKeyCount: localeKeys.length,
      missingInLocales,
      unusedLocaleKeys,
    },
    perKeyCoverage,
    localeEntries,
  };
};

