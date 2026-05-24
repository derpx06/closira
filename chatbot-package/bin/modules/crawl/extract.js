import { uniq } from "./shared.js";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

const parseInlineMethod = (argExpr = "") => {
  const m = argExpr.match(/method\s*:\s*["'`](GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)["'`]/i);
  return m?.[1]?.toUpperCase() ?? null;
};

const inferPathParameters = (targetExpr) => {
  const vars = [];
  for (const m of targetExpr.matchAll(/\$\{([^}]+)\}/g)) vars.push(m[1].trim());
  return uniq(vars);
};

const inferQueryParameters = (targetExpr) => {
  const keys = [];
  for (const m of targetExpr.matchAll(/[?&]([A-Za-z0-9_-]+)=/g)) keys.push(m[1]);
  for (const m of targetExpr.matchAll(/searchParams\.append\(\s*["'`]([^"'`]+)["'`]/g)) keys.push(m[1]);
  return uniq(keys);
};

const inferBodySource = (argExpr = "") => {
  const json = argExpr.match(/body\s*:\s*JSON\.stringify\(\s*([^)]+?)\s*\)/);
  if (json) return `JSON.stringify(${json[1].trim()})`;
  const direct = argExpr.match(/body\s*:\s*([^,}\n]+)/);
  if (direct) return direct[1].trim();
  return null;
};

const inferHeaderSources = (argExpr = "") => {
  const headers = [];
  if (/Authorization/i.test(argExpr)) headers.push("Authorization");
  if (/Content-Type/i.test(argExpr)) headers.push("Content-Type");
  if (/process\.env\.[A-Z0-9_]+/.test(argExpr)) headers.push("process.env");
  return uniq(headers);
};

const normalizeApiTarget = (expr) => {
  const match = expr.match(/["'`]([^"'`]*\/api\/[^"'`]*)["'`]/);
  return match?.[1] ?? null;
};

export const extractApiMethods = (content) => {
  const methods = new Set();

  const named = content.matchAll(
    /\bexport\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g,
  );
  for (const m of named) methods.add(m[1]);

  const compare = content.matchAll(
    /req\.method\s*(?:===|==)\s*["'`](GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)["'`]/g,
  );
  for (const m of compare) methods.add(m[1]);

  const switchCases = content.matchAll(/case\s+["'`](GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)["'`]/g);
  for (const m of switchCases) methods.add(m[1]);

  return [...methods];
};

export const extractMetadata = (content) => {
  const blockMatch = content.match(/export\s+const\s+metadata\s*=\s*({[\s\S]*?})\s*;?/);
  if (!blockMatch) return null;
  const block = blockMatch[1];

  const name = block.match(/name\s*:\s*["'`]([^"'`]+)["'`]/)?.[1] ?? null;
  const description = block.match(/description\s*:\s*["'`]([^"'`]+)["'`]/)?.[1] ?? null;
  const parameters = block.match(/parameters\s*:\s*({[\s\S]*?})/)?.[1] ?? null;
  return { name, description, parametersRaw: parameters };
};

export const extractAiFlags = (content) => {
  const expose = content.match(/export\s+const\s+ai\s*=\s*{[\s\S]*?expose\s*:\s*(true|false)/)?.[1];
  return { expose: expose ? expose === "true" : null };
};

export const extractTextSnippets = (content, isMarkdown, maxSnippets) => {
  if (isMarkdown) {
    return uniq(
      content
        .split(/\n\s*\n/g)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p.length > 20),
    ).slice(0, maxSnippets);
  }

  const snippets = new Set();
  for (const m of content.matchAll(/>\s*([^<>{}\n][^<>{}\n]{2,180})\s*</g)) {
    const line = m[1].replace(/\s+/g, " ").trim();
    if (line.length >= 3) snippets.add(line);
  }
  for (const m of content.matchAll(/["'`]([A-Za-z][^"'`\n]{6,200})["'`]/g)) {
    const line = m[1].replace(/\s+/g, " ").trim();
    if (/^(use client|use server)$/i.test(line)) continue;
    if (line.length >= 7) snippets.add(line);
  }
  return [...snippets].slice(0, maxSnippets);
};

export const extractCalls = (content) => {
  const out = [];

  const isUsefulTarget = (targetExpr) => {
    if (!targetExpr) return false;
    if (/^["'`][^"'`]+["'`]$/.test(targetExpr)) {
      const plain = targetExpr.slice(1, -1);
      if (plain.startsWith("#")) return false;
      if (plain.startsWith("mailto:")) return false;
      if (plain.startsWith("tel:")) return false;
      if (/^\.\.?\//.test(plain)) return false;
    }
    return true;
  };

  for (const m of content.matchAll(/\bfetch\s*\(\s*([^,)\n]+)([\s\S]{0,350}?)\)/g)) {
    const targetExpr = m[1].trim();
    if (!isUsefulTarget(targetExpr)) continue;
    const optionsExpr = m[2] ?? "";
    out.push({
      type: "fetch",
      targetExpr: targetExpr.slice(0, 300),
      apiTarget: normalizeApiTarget(targetExpr),
      method: parseInlineMethod(optionsExpr) ?? "GET",
      params: {
        path: inferPathParameters(targetExpr),
        query: inferQueryParameters(targetExpr),
        bodySource: inferBodySource(optionsExpr),
        headerSources: inferHeaderSources(optionsExpr),
      },
    });
  }

  for (const m of content.matchAll(/\baxios\.(get|post|put|patch|delete)\s*\(\s*([^,)\n]+)([\s\S]{0,250}?)\)/g)) {
    const method = m[1].toUpperCase();
    const targetExpr = m[2].trim();
    if (!isUsefulTarget(targetExpr)) continue;
    const optionsExpr = m[3] ?? "";
    out.push({
      type: `axios.${m[1]}`,
      targetExpr: targetExpr.slice(0, 300),
      apiTarget: normalizeApiTarget(targetExpr),
      method,
      params: {
        path: inferPathParameters(targetExpr),
        query: inferQueryParameters(targetExpr),
        bodySource: method === "GET" ? null : (optionsExpr.trim() || null),
        headerSources: inferHeaderSources(optionsExpr),
      },
    });
  }

  for (const m of content.matchAll(/\brouter\.(push|replace)\s*\(\s*([^)]+)\)/g)) {
    const targetExpr = m[2].trim();
    if (!isUsefulTarget(targetExpr)) continue;
    out.push({
      type: `router.${m[1]}`,
      targetExpr: targetExpr.slice(0, 300),
      apiTarget: null,
      method: "NAVIGATE",
      params: {
        path: inferPathParameters(targetExpr),
        query: inferQueryParameters(targetExpr),
        bodySource: null,
        headerSources: [],
      },
    });
  }

  for (const m of content.matchAll(/\bhref\s*=\s*["'`]([^"'`]+)["'`]/g)) {
    if (!isUsefulTarget(m[1].trim())) continue;
    out.push({
      type: "href",
      targetExpr: m[1].trim(),
      apiTarget: null,
      method: "NAVIGATE",
      params: {
        path: [],
        query: inferQueryParameters(m[1]),
        bodySource: null,
        headerSources: [],
      },
    });
  }

  return out;
};

export const inferRouteParameters = (route = "") => {
  const params = [...route.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  if (route.includes("*")) params.push("catchAll");
  return uniq(params);
};

export const inferApiInputHints = (content) => {
  const hints = {
    searchParams: uniq([...content.matchAll(/searchParams\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map((m) => m[1])),
    query: uniq([...content.matchAll(/req\.query\.([A-Za-z0-9_]+)/g)].map((m) => m[1])),
    body: uniq([...content.matchAll(/(?:req|request)\.(?:body|json\(\))\.?([A-Za-z0-9_]*)/g)].map((m) => m[1]).filter(Boolean)),
    params: uniq([...content.matchAll(/params\.([A-Za-z0-9_]+)/g)].map((m) => m[1])),
    cookies: uniq([...content.matchAll(/cookies?\(\)\.get\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1])),
  };
  return hints;
};

export const extractEnvKeys = (content) => uniq([...content.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]));

export const isHttpMethod = (method) => HTTP_METHODS.includes((method ?? "").toUpperCase());

export const extractServerActions = (content, file) => {
  const hasUseServer = /["'`]use server["'`]/.test(content);
  if (!hasUseServer) return [];

  const actions = [];
  for (const m of content.matchAll(/\bexport\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g)) {
    actions.push({
      file,
      name: m[1],
      args: m[2].trim() || null,
      source: "exported-server-action",
    });
  }
  for (const m of content.matchAll(/\bconst\s+([A-Za-z0-9_]+)\s*=\s*async\s*\(([^)]*)\)\s*=>/g)) {
    actions.push({
      file,
      name: m[1],
      args: m[2].trim() || null,
      source: "local-server-action",
    });
  }

  return uniq(actions.map((a) => JSON.stringify(a))).map((x) => JSON.parse(x));
};

export const extractI18nUsageKeys = (content, file) => {
  const out = [];

  for (const m of content.matchAll(/\bt\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    out.push({ file, key: m[1], source: "t()" });
  }
  for (const m of content.matchAll(/\bi18n\.t\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    out.push({ file, key: m[1], source: "i18n.t()" });
  }
  for (const m of content.matchAll(/\bformatMessage\(\s*{[\s\S]{0,100}?id\s*:\s*["'`]([^"'`]+)["'`]/g)) {
    out.push({ file, key: m[1], source: "formatMessage(id)" });
  }
  for (const m of content.matchAll(/\buseTranslations\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    out.push({ file, key: m[1], source: "useTranslations(namespace)" });
  }

  return uniq(out.map((x) => JSON.stringify(x))).map((x) => JSON.parse(x));
};

const flattenObject = (obj, prefix = "") => {
  const rows = [];
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) rows.push(...flattenObject(v, key));
    else rows.push({ key, value: typeof v === "string" ? v : JSON.stringify(v) });
  }
  return rows;
};

export const parseLocaleFile = (raw, file) => {
  try {
    const parsed = JSON.parse(raw);
    const flat = flattenObject(parsed);
    return {
      file,
      entries: flat,
      parseError: null,
    };
  } catch (error) {
    return {
      file,
      entries: [],
      parseError: String(error?.message ?? error),
    };
  }
};
