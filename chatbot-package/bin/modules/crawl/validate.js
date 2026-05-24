export const buildExtractionHealth = ({
  files,
  apis,
  pages,
  contentFiles,
  calls,
  tooling,
  droppedFiles,
}) => {
  const lowerFiles = files.map((f) => f.toLowerCase());
  const warnings = [];

  const rawHints = {
    possibleApiFiles: lowerFiles.filter((f) => /(^|\/)(app\/api\/|pages\/api\/|api\/)/.test(f)).length,
    possiblePageFiles: lowerFiles.filter((f) => /(^|\/)(app\/.*\/page\.[tj]sx?$|pages\/[^/]+\.[tj]sx?$|pages\/.*\/index\.[tj]sx?$)/.test(f)).length,
    possibleContentFiles: lowerFiles.filter((f) => /\.(md|mdx)$/.test(f)).length,
  };

  if (rawHints.possibleApiFiles > 0 && apis.length === 0) {
    warnings.push("Detected API-like files but extracted 0 APIs.");
  }
  if (rawHints.possiblePageFiles > 0 && pages.length === 0) {
    warnings.push("Detected page-like files but extracted 0 pages.");
  }
  if (rawHints.possibleContentFiles > 0 && contentFiles.length === 0) {
    warnings.push("Detected markdown/MDX files but extracted 0 content entries.");
  }
  if (apis.length > 0 && tooling.length === 0) {
    warnings.push("APIs exist but tool definitions are empty.");
  }
  if (calls.length > 0 && apis.length > 0 && calls.filter((c) => c.apiTarget).length === 0) {
    warnings.push("Calls were detected but none mapped to API-like targets.");
  }

  const droppedCritical = droppedFiles.filter((f) =>
    /(api|page|route|handler|controller|service|auth|billing|order|profile|support)/i.test(f.file),
  );
  if (droppedCritical.length > 0) {
    warnings.push(`Dropped ${droppedCritical.length} potentially critical files. Review dropped-files.json.`);
  }

  const score = Math.max(0, 100 - warnings.length * 15);
  const status = score >= 85 ? "excellent" : score >= 65 ? "good" : score >= 45 ? "warning" : "critical";

  return {
    status,
    score,
    warnings,
    rawHints,
    extracted: {
      apis: apis.length,
      pages: pages.length,
      content: contentFiles.length,
      calls: calls.length,
      tooling: tooling.length,
      dropped: droppedFiles.length,
    },
  };
};

