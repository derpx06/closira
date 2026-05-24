const toTable = (headers, rows) => {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map((x) => String(x).replace(/\|/g, "\\|")).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
};

export const generateMdx = (result) => {
  const { summary, pages, apis, components, contentFiles, configs, calls, linkages, outputMeta, extractionHealth, serverActions, i18nMap } = result;
  const pageRows = pages.map((p) => [p.route ?? "-", p.file, p.textCount, p.callCount]);
  const apiRows = apis.map((a) => [
    a.route,
    a.methods.length ? a.methods.join(", ") : "unknown",
    (a.routeParams ?? []).join(", ") || "-",
    a.file,
  ]);
  const callRows = calls.slice(0, 300).map((c) => [
    c.type,
    c.method,
    c.apiTarget ?? c.targetExpr,
    c.params.path.join(", ") || "-",
    c.params.query.join(", ") || "-",
    c.params.bodySource ?? "-",
    c.file,
  ]);
  const envRows = configs.flatMap((c) => c.envKeys.map((k) => [k, c.file]));
  const linkageRows = linkages.apiCalls.map((l) => [l.route, l.callerCount, l.callerFiles.join(", ") || "-"]);

  return `# SupportHub Crawl Report

Generated at: ${outputMeta.generatedAt}
Codebase root: \`${outputMeta.rootDir}\`
Scan mode: \`${outputMeta.scanMode}\`
Include tests: \`${String(outputMeta.includeTests)}\`

## Executive Summary

- Total scanned files: **${summary.totalFiles}**
- Kept (high-signal) files: **${summary.keptFiles}**
- Dropped (low-signal) files: **${summary.droppedFiles}**
- APIs discovered: **${summary.apiCount}**
- Pages discovered: **${summary.pageCount}**
- Components discovered: **${summary.componentCount}**
- Content files discovered: **${summary.contentCount}**
- Config/data files discovered: **${summary.configCount}**
- Call references extracted: **${summary.callCount}**
- Text snippets extracted: **${summary.textSnippetCount}**
- Knowledge chunks created: **${summary.knowledgeChunkCount}**
- Server actions discovered: **${summary.serverActionCount}**
- i18n keys used in UI: **${summary.i18nUsageCount}**
- i18n keys in locale files: **${summary.localeEntryCount}**

## Extraction Health

- Status: **${extractionHealth.status}**
- Score: **${extractionHealth.score}/100**
- Warnings: **${extractionHealth.warnings.length}**
${extractionHealth.warnings.length ? extractionHealth.warnings.map((w) => `- ${w}`).join("\n") : "- No critical extraction warnings detected."}

## APIs (Tool-ready)

${toTable(["Route", "Methods", "Route Params", "File"], apiRows.length ? apiRows : [["-", "-", "-", "-"]])}

## API Call Linkages

${toTable(["API Route", "Caller Count", "Caller Files"], linkageRows.length ? linkageRows : [["-", "-", "-"]])}

## Server Actions

${toTable(
  ["Action Name", "Args", "Source", "File"],
  (serverActions ?? []).length
    ? serverActions.map((a) => [a.name, a.args ?? "-", a.source, a.file])
    : [["-", "-", "-", "-"]],
)}

## i18n Mapping

- Missing UI keys in locale files: **${i18nMap.coverage.missingInLocales.length}**
- Unused locale keys: **${i18nMap.coverage.unusedLocaleKeys.length}**

${toTable(
  ["i18n Key", "Used In Files", "Locales Found"],
  (i18nMap.perKeyCoverage ?? []).length
    ? i18nMap.perKeyCoverage.slice(0, 300).map((k) => [k.key, k.usedInFiles.join(", ") || "-", k.localesFound.join(", ") || "-"])
    : [["-", "-", "-"]],
)}

## Pages

${toTable(
  ["Route", "File", "Text Snippets", "Call References"],
  pageRows.length ? pageRows : [["-", "-", "-", "-"]],
)}

## Components

${toTable(
  ["Component File", "Text Snippets", "Call References"],
  components.length
    ? components.map((c) => [c.file, c.textCount, c.callCount])
    : [["-", "-", "-"]],
)}

## Content Files

${toTable(
  ["File", "Paragraph Chunks"],
  contentFiles.length ? contentFiles.map((c) => [c.file, c.textCount]) : [["-", "-"]],
)}

## Config / Environment Keys

${toTable(["Env Key", "Source File"], envRows.length ? envRows : [["-", "-"]])}

## Call References (Top 300)

${toTable(
  ["Type", "Method", "Target", "Path Params", "Query Params", "Body Source", "File"],
  callRows.length ? callRows : [["-", "-", "-", "-", "-", "-", "-"]],
)}

## Output Files

- \`repo-map.json\`
- \`summary.json\`
- \`apis.json\`
- \`pages.json\`
- \`components.json\`
- \`content.json\`
- \`config.json\`
- \`calls.json\`
- \`linkages.json\`
- \`knowledge-chunks.json\`
- \`tooling.json\`
- \`server-actions.json\`
- \`i18n-map.json\`
- \`dropped-files.json\`
- \`extraction-health.json\`
- \`crawl-report.mdx\`

## Notes

- This report is generated **without AI**.
- Extraction uses static analysis and deterministic heuristics.
- These outputs are designed to directly power an external RAG/tool-calling layer later.
`;
};
