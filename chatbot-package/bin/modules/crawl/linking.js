import { uniq } from "./shared.js";

const routeToRegex = (route) => {
  const pattern = route
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\:([A-Za-z0-9_]+)/g, "[^/]+")
    .replace(/\\\*/g, ".*");
  return new RegExp(`^${pattern}(?:\\?.*)?$`);
};

const normalizeApiPath = (target) => {
  if (!target) return null;
  const clean = target.replace(/^https?:\/\/[^/]+/i, "");
  const apiStart = clean.indexOf("/api/");
  if (apiStart === -1) return null;
  return clean.slice(apiStart).replace(/\/+$/, "") || "/api";
};

export const buildApiCallLinkages = (apis, calls) => {
  const apiMatchers = apis.map((api) => ({
    route: api.route,
    file: api.file,
    regex: routeToRegex(api.route),
  }));

  const output = apis.map((api) => ({ route: api.route, file: api.file, callers: [] }));

  for (const call of calls) {
    const normalized = normalizeApiPath(call.apiTarget);
    if (!normalized) continue;
    for (let i = 0; i < apiMatchers.length; i += 1) {
      if (apiMatchers[i].regex.test(normalized)) {
        output[i].callers.push({
          file: call.file,
          method: call.method,
          type: call.type,
          target: call.apiTarget,
          params: call.params,
        });
      }
    }
  }

  return output.map((x) => ({
    ...x,
    callerCount: x.callers.length,
    callerFiles: uniq(x.callers.map((c) => c.file)),
  }));
};

export const buildPageNavigationHints = (pages, calls) => {
  return pages.map((page) => {
    const navCalls = calls.filter((c) => c.file === page.file && (c.type === "href" || c.type.startsWith("router.")));
    return {
      file: page.file,
      route: page.route,
      outboundLinks: uniq(navCalls.map((x) => x.targetExpr).filter(Boolean)),
    };
  });
};

export const buildKnowledgeChunks = ({ pages, components, contentFiles, apis }) => {
  const chunks = [];
  let idx = 1;

  const pushChunk = (type, source, text, extra = {}) => {
    if (!text || text.length < 8) return;
    chunks.push({
      id: `chunk_${String(idx).padStart(4, "0")}`,
      type,
      source,
      content: text,
      ...extra,
    });
    idx += 1;
  };

  for (const page of pages) {
    for (const text of page.sampleText ?? []) pushChunk("page-text", page.file, text, { route: page.route ?? null });
  }
  for (const c of components) {
    for (const text of c.sampleText ?? []) pushChunk("component-text", c.file, text);
  }
  for (const md of contentFiles) {
    for (const text of md.sampleText ?? []) pushChunk("content-text", md.file, text);
  }
  for (const api of apis) {
    const desc = api.metadata?.description;
    if (desc) pushChunk("api-description", api.file, desc, { route: api.route, methods: api.methods });
  }

  return chunks;
};

