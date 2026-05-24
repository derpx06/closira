import fs from "node:fs/promises";
import path from "node:path";
import { walkFiles } from "./crawl/discovery.js";
import { classifyPath, extractRouteFromFile } from "./crawl/classify.js";
import {
  extractAiFlags,
  extractApiMethods,
  extractCalls,
  extractEnvKeys,
  extractI18nUsageKeys,
  extractMetadata,
  extractServerActions,
  extractTextSnippets,
  inferApiInputHints,
  inferRouteParameters,
  isHttpMethod,
  parseLocaleFile,
} from "./crawl/extract.js";
import { buildApiCallLinkages, buildKnowledgeChunks, buildPageNavigationHints } from "./crawl/linking.js";
import { generateMdx } from "./crawl/report.js";
import { CONTENT_EXTENSIONS, toPosix } from "./crawl/shared.js";
import { filterUsefulSnippets, shouldKeepFile, shouldKeepOtherCode } from "./crawl/filter.js";
import { buildExtractionHealth } from "./crawl/validate.js";
import { buildI18nMap } from "./crawl/i18n.js";

export const runCodebaseCrawl = async ({ rootDir, scanMode, includeTests, outputDir }) => {
  const resolvedRoot = path.resolve(rootDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const finalOutputDir = path.resolve(outputDir, `crawl-${stamp}`);
  await fs.mkdir(finalOutputDir, { recursive: true });

  const files = await walkFiles(resolvedRoot, includeTests);
  const apis = [];
  const pages = [];
  const components = [];
  const contentFiles = [];
  const configs = [];
  const calls = [];
  const droppedFiles = [];
  const serverActions = [];
  const i18nUsages = [];
  const localeFiles = [];

  const depthMap = {
    fast: { page: 10, component: 8, content: 15 },
    standard: { page: 20, component: 15, content: 30 },
    deep: { page: 35, component: 30, content: 50 },
  };
  const depth = depthMap[scanMode] ?? depthMap.standard;

  for (const abs of files) {
    const relative = toPosix(path.relative(resolvedRoot, abs));
    const kind = classifyPath(relative);
    const content = await fs.readFile(abs, "utf8");
    const route = extractRouteFromFile(relative, kind);
    const isMarkdown = CONTENT_EXTENSIONS.has(path.extname(abs).toLowerCase());
    const maxText = isMarkdown ? depth.content : (kind.includes("page") ? depth.page : depth.component);
    const textSnippets = filterUsefulSnippets(extractTextSnippets(content, isMarkdown, maxText));
    const extractedCalls = extractCalls(content).map((c) => ({ ...c, file: relative }));
    const envKeys = extractEnvKeys(content);
    const extractedServerActions = extractServerActions(content, relative);
    const extractedI18nUsages = extractI18nUsageKeys(content, relative);
    const parsedLocale = kind === "locale" ? parseLocaleFile(content, relative) : null;
    const methods = kind === "api-app-router" || kind === "api-pages-router" ? extractApiMethods(content).filter(isHttpMethod) : [];

    const fileDecision = shouldKeepFile({
      relativePath: relative,
      kind,
      textCount: textSnippets.length,
      callCount: extractedCalls.length,
      hasRoute: Boolean(route),
      apiMethodCount: methods.length,
      envKeyCount: envKeys.length,
    });

    if (!fileDecision.keep) {
      droppedFiles.push({
        file: relative,
        kind,
        score: fileDecision.score,
        reasons: fileDecision.reasons,
      });
      continue;
    }

    if (
      kind === "other-code" &&
      !shouldKeepOtherCode({
        callCount: extractedCalls.length,
        envKeyCount: envKeys.length,
        serverActionCount: extractedServerActions.length,
        i18nUsageCount: extractedI18nUsages.length,
        textCount: textSnippets.length,
      })
    ) {
      droppedFiles.push({
        file: relative,
        kind,
        score: fileDecision.score,
        reasons: ["other-code-low-signal"],
      });
      continue;
    }

    if (kind === "api-app-router" || kind === "api-pages-router") {
      apis.push({
        file: relative,
        route: route ?? "-",
        methods,
        routeParams: inferRouteParameters(route ?? ""),
        metadata: extractMetadata(content),
        ai: extractAiFlags(content),
        inputHints: inferApiInputHints(content),
        callCount: extractedCalls.length,
        envKeys,
        textCount: textSnippets.length,
      });
    } else if (kind === "page-app-router" || kind === "page-pages-router") {
      pages.push({
        file: relative,
        route,
        textCount: textSnippets.length,
        sampleText: textSnippets,
        callCount: extractedCalls.length,
        envKeys,
      });
    } else if (kind === "component") {
      components.push({
        file: relative,
        textCount: textSnippets.length,
        sampleText: textSnippets,
        callCount: extractedCalls.length,
        envKeys,
      });
    } else if (kind === "other-code") {
      configs.push({
        file: relative,
        envKeys,
        textCount: textSnippets.length,
      });
    } else if (kind === "content") {
      contentFiles.push({
        file: relative,
        textCount: textSnippets.length,
        sampleText: textSnippets,
      });
    } else if (kind === "config") {
      configs.push({
        file: relative,
        envKeys,
        textCount: textSnippets.length,
      });
    }

    calls.push(...extractedCalls);
    serverActions.push(...extractedServerActions);
    i18nUsages.push(...extractedI18nUsages);
    if (parsedLocale) localeFiles.push(parsedLocale);
  }

  const repoMap = {
    apis: apis.map((x) => x.file),
    pages: pages.map((x) => x.file),
    components: components.map((x) => x.file),
    content: contentFiles.map((x) => x.file),
    config: configs.map((x) => x.file),
  };

  const linkages = {
    apiCalls: buildApiCallLinkages(apis, calls),
    pageNavigation: buildPageNavigationHints(pages, calls),
  };

  const knowledgeChunks = buildKnowledgeChunks({ pages, components, contentFiles, apis });
  const i18nMap = buildI18nMap({ usages: i18nUsages, localeFiles });

  const tooling = apis
    .filter((api) => api.ai?.expose !== false)
    .map((api) => ({
      toolName:
        api.metadata?.name ??
        `${api.methods[0] ?? "GET"}_${api.route.replace(/[/:*]+/g, "_").replace(/^_+|_+$/g, "")}`,
      description: api.metadata?.description ?? `Call ${api.methods.join("/") || "UNKNOWN"} ${api.route}`,
      route: api.route,
      methods: api.methods,
      parameters: {
        routeParams: api.routeParams,
        queryHints: api.inputHints?.searchParams ?? [],
        queryObjectHints: api.inputHints?.query ?? [],
        bodyHints: api.inputHints?.body ?? [],
        paramHints: api.inputHints?.params ?? [],
        metadataRaw: api.metadata?.parametersRaw ?? null,
      },
      security: {
        exposed: api.ai?.expose !== false,
      },
      sourceFile: api.file,
    }));

  const summary = {
    totalFiles: files.length,
    keptFiles: files.length - droppedFiles.length,
    droppedFiles: droppedFiles.length,
    apiCount: apis.length,
    pageCount: pages.length,
    componentCount: components.length,
    contentCount: contentFiles.length,
    configCount: configs.length,
    callCount: calls.length,
    knowledgeChunkCount: knowledgeChunks.length,
    serverActionCount: serverActions.length,
    i18nUsageCount: i18nMap.coverage.usageKeyCount,
    localeEntryCount: i18nMap.coverage.localeKeyCount,
    textSnippetCount:
      apis.reduce((s, x) => s + x.textCount, 0) +
      pages.reduce((s, x) => s + x.textCount, 0) +
      components.reduce((s, x) => s + x.textCount, 0) +
      contentFiles.reduce((s, x) => s + x.textCount, 0) +
      configs.reduce((s, x) => s + x.textCount, 0),
  };

  const extractionHealth = buildExtractionHealth({
    files: files.map((x) => toPosix(path.relative(resolvedRoot, x))),
    apis,
    pages,
    contentFiles,
    calls,
    tooling,
    droppedFiles,
  });

  const result = {
    outputMeta: {
      generatedAt: new Date().toISOString(),
      rootDir: resolvedRoot,
      scanMode,
      includeTests,
    },
    summary,
    repoMap,
    apis,
    pages,
    components,
    contentFiles,
    configs,
    calls,
    linkages,
    knowledgeChunks,
    tooling,
    serverActions,
    i18nMap,
    extractionHealth,
  };

  await Promise.all([
    fs.writeFile(path.join(finalOutputDir, "repo-map.json"), `${JSON.stringify(repoMap, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "apis.json"), `${JSON.stringify(apis, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "pages.json"), `${JSON.stringify(pages, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "components.json"), `${JSON.stringify(components, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "content.json"), `${JSON.stringify(contentFiles, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "config.json"), `${JSON.stringify(configs, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "calls.json"), `${JSON.stringify(calls, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "linkages.json"), `${JSON.stringify(linkages, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "knowledge-chunks.json"), `${JSON.stringify(knowledgeChunks, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "tooling.json"), `${JSON.stringify(tooling, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "server-actions.json"), `${JSON.stringify(serverActions, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "i18n-map.json"), `${JSON.stringify(i18nMap, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "dropped-files.json"), `${JSON.stringify(droppedFiles, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "extraction-health.json"), `${JSON.stringify(extractionHealth, null, 2)}\n`),
    fs.writeFile(path.join(finalOutputDir, "crawl-report.mdx"), generateMdx(result)),
  ]);

  return {
    outputDir: finalOutputDir,
    summary,
    repoMap,
  };
};
