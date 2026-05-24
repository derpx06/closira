#!/usr/bin/env node

import chalk from "chalk";
import boxen from "boxen";
import figlet from "figlet";
import gradient from "gradient-string";
import ora from "ora";
import { input, password, select, confirm } from "@inquirer/prompts";
import { runCodebaseCrawl } from "./modules/crawl-codebase.js";

const command = process.argv[2];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waveFrames = ["▁▂▃▄▅▆▇█", "▂▃▄▅▆▇█▆", "▃▄▅▆▇█▆▅", "▄▅▆▇█▆▅▄", "▅▆▇█▆▅▄▃", "▆▇█▆▅▄▃▂", "▇█▆▅▄▃▂▁"];
const ascii = (text) => figlet.textSync(text, { font: "Small", horizontalLayout: "fitted" });

const showWaveLoader = async (label, cycles = 10, frameDelay = 65) => {
  process.stdout.write("\n");
  for (let i = 0; i < cycles; i += 1) {
    const frame = waveFrames[i % waveFrames.length];
    const color = i % 2 === 0 ? gradient.pastel(frame) : gradient.cristal(frame);
    process.stdout.write(`\r${chalk.cyan(label)} ${color}`);
    await sleep(frameDelay);
  }
  process.stdout.write(`\r${chalk.green(label)} ${chalk.green("████████ done")}\n`);
};

const banner = async () => {
  const raw = `
     ___  ___    _ __      __ _      ___  _   _  __  __  __  __    _    ___ __   __
    / __|| _ \\  /_\\\\ \\    / /| |    / __|| | | ||  \\/  ||  \\/  |  /_\\  | _ \\\\ \\ / /
   | (__ |   / / _ \\\\ \\/\\/ / | |__  \\__ \\| |_| || |\\/| || |\\/| | / _ \\ |   / \\ V /
    \\___||_|_\\/_/ \\_\\\\_\\/\\_/  |____| |___/ \\___/ |_|  |_||_|  |_|/_/ \\_\\|_|_\\  |_|
  `.trim();
  const renders = [
    gradient.rainbow.multiline(raw),
    gradient.pastel.multiline(raw),
    gradient.fruit.multiline(raw),
    gradient.instagram.multiline(raw),
  ];

  for (let i = 0; i < renders.length; i += 1) {
    process.stdout.write("\x1b[2J\x1b[0f");
    console.log(renders[i]);
    console.log(chalk.cyanBright("Smart support-agent workflow launcher"));
    console.log(chalk.gray("Loading terminal experience...\n"));
    await sleep(120);
  }
};

const runCinematicLoader = async (steps) => {
  const spinner = ora({ text: chalk.cyan(steps[0].label), spinner: "dots12" }).start();
  for (let i = 0; i < steps.length; i += 1) {
    spinner.text = chalk.cyan(steps[i].label);
    await sleep(steps[i].ms);
    spinner.succeed(chalk.green(`${steps[i].label} complete`));
    if (i < steps.length - 1) {
      spinner.start(chalk.cyan(steps[i + 1].label));
    }
  }
  await showWaveLoader("Finalizing", 12, 55);
};

const printHelp = () => {
  const asciiHelp = gradient.atlas.multiline(ascii("SUPPORTHUB"));
  console.log(
    boxen(
      [
        asciiHelp,
        chalk.bold("Usage"),
        "  npm run cli -- <command>",
        "  supporthub <command>",
        chalk.bold("Commands"),
        "  crawl      Explore current codebase structure",
        "  config     Save agent/app configuration",
        "  ingest     Ingest docs/tickets/chats",
        "  classify   Classify one support message",
        "  ask        Draft support answer + guidance",
        "  navigate   Generate step-by-step navigation",
        "  status     Show current CLI readiness",
        "  hello      Quick hello test",
        "  help       Show this help",
      ].join("\n"),
      { padding: 1, borderStyle: "round", borderColor: "cyan" },
    ),
  );
};

const doneBox = (title, lines) => {
  const asciiTitle = gradient.morning.multiline(ascii(title.toUpperCase()));
  console.log(
    boxen([asciiTitle, ...lines].join("\n"), {
      padding: 1,
      borderStyle: "round",
      borderColor: "green",
    }),
  );
};

const runCrawl = async () => {
  const codebasePath = await input({
    message: "Codebase path to explore:",
    default: ".",
  });
  const scanMode = await select({
    message: "Codebase scan mode:",
    choices: [
      { name: "Fast (folders + key files)", value: "fast" },
      { name: "Standard (routes + features + APIs)", value: "standard" },
      { name: "Deep (semantic app map)", value: "deep" },
    ],
  });
  const includeTests = await confirm({
    message: "Include test files in exploration?",
    default: false,
  });
  const outputBaseDir = await input({
    message: "Output base folder:",
    default: "./supporthub-output",
  });

  await runCinematicLoader([
    { label: "Resolving codebase root", ms: 420 },
    { label: "Scanning folders and routes", ms: 520 },
    { label: "Linking features to APIs", ms: 480 },
    { label: "Building support knowledge map", ms: 430 },
  ]);

  const crawlSpinner = ora(chalk.cyan("Running static codebase extraction...")).start();
  const result = await runCodebaseCrawl({
    rootDir: codebasePath,
    scanMode,
    includeTests,
    outputDir: outputBaseDir,
  });
  crawlSpinner.succeed(chalk.green("Extraction completed successfully."));

  doneBox("Crawl Summary", [
    `Path: ${chalk.yellow(codebasePath)}`,
    `Mode: ${chalk.yellow(scanMode)}`,
    `Include tests: ${chalk.yellow(String(includeTests))}`,
    `Scanned files: ${chalk.yellow(String(result.summary.totalFiles))}`,
    `APIs: ${chalk.yellow(String(result.summary.apiCount))}`,
    `Pages: ${chalk.yellow(String(result.summary.pageCount))}`,
    `Components: ${chalk.yellow(String(result.summary.componentCount))}`,
    `Output folder: ${chalk.yellow(result.outputDir)}`,
    "Generated: repo-map.json, summary.json, apis.json, pages.json, components.json, content.json, config.json, calls.json, linkages.json, knowledge-chunks.json, tooling.json, server-actions.json, i18n-map.json, dropped-files.json, extraction-health.json, crawl-report.mdx",
  ]);
};

const runConfig = async () => {
  const agentName = await input({
    message: "Agent name:",
    default: "SupportHub Agent",
  });
  const provider = await select({
    message: "Model provider:",
    choices: [
      { name: "OpenAI", value: "openai" },
      { name: "Anthropic", value: "anthropic" },
      { name: "Other", value: "other" },
    ],
  });
  const modelName = await input({
    message: "Model name:",
    default: provider === "openai" ? "gpt-5.4-mini" : "default-model",
  });
  const apiKey = await password({
    message: "API key:",
    mask: "*",
  });
  const dashboardUrl = await input({
    message: "Dashboard URL:",
    default: "http://localhost:3000",
  });
  const appBaseUrl = await input({
    message: "Application base URL:",
    default: "http://localhost:5173",
  });
  const saveLocal = await confirm({
    message: "Save to local .env? (placeholder only)",
    default: true,
  });

  await runCinematicLoader([
    { label: "Validating provider config", ms: 380 },
    { label: "Encrypting local secrets", ms: 460 },
    { label: "Syncing runtime profile", ms: 360 },
  ]);

  doneBox("Config Summary", [
    `Agent name: ${chalk.yellow(agentName)}`,
    `Provider: ${chalk.yellow(provider)}`,
    `Model: ${chalk.yellow(modelName)}`,
    `API key length: ${chalk.yellow(String(apiKey.length))}`,
    `Dashboard URL: ${chalk.yellow(dashboardUrl)}`,
    `App base URL: ${chalk.yellow(appBaseUrl)}`,
    `Save local: ${chalk.yellow(String(saveLocal))}`,
  ]);
};

const runIngest = async () => {
  const sourceType = await select({
    message: "Ingest source type:",
    choices: [
      { name: "Codebase", value: "codebase" },
      { name: "Support docs", value: "docs" },
      { name: "Tickets CSV", value: "tickets" },
      { name: "Chat exports", value: "chats" },
    ],
  });
  const sourcePath = await input({
    message: "Path or URL:",
    default: "./data",
  });

  await runCinematicLoader([
    { label: "Reading source payload", ms: 450 },
    { label: "Chunking and cleaning content", ms: 520 },
    { label: "Building retrieval index", ms: 500 },
  ]);

  doneBox("Ingest Summary", [
    `Source type: ${chalk.yellow(sourceType)}`,
    `Source path: ${chalk.yellow(sourcePath)}`,
    "Status: indexed mock chunks",
  ]);
};

const runClassify = async () => {
  const message = await input({
    message: "Paste user support message:",
    default: "My payment failed but money got deducted.",
  });
  await runCinematicLoader([
    { label: "Normalizing support text", ms: 380 },
    { label: "Running intent classifier", ms: 520 },
    { label: "Scoring priority/confidence", ms: 420 },
  ]);

  doneBox("Classification Result", [
    `Message: ${chalk.yellow(message)}`,
    "Predicted category: billing",
    "Predicted priority: high",
  ]);
};

const runAsk = async () => {
  const question = await input({
    message: "User question:",
    default: "Where is my profile page?",
  });
  const style = await select({
    message: "Response style:",
    choices: [
      { name: "Short answer", value: "short" },
      { name: "Step-by-step guidance", value: "guided" },
      { name: "Answer + next action", value: "actionable" },
    ],
  });

  await runCinematicLoader([
    { label: "Retrieving relevant app knowledge", ms: 480 },
    { label: "Planning answer and guidance", ms: 500 },
    { label: "Composing support response", ms: 430 },
  ]);

  doneBox("Support Draft", [
    `Question: ${chalk.yellow(question)}`,
    `Style: ${chalk.yellow(style)}`,
    "Output: smart support reply (mock)",
  ]);
};

const runNavigate = async () => {
  const feature = await input({
    message: "Feature user wants to reach:",
    default: "Profile",
  });
  const entryPoint = await input({
    message: "Current page/starting point:",
    default: "Dashboard",
  });

  await runCinematicLoader([
    { label: "Locating feature route", ms: 380 },
    { label: "Building click path guidance", ms: 460 },
    { label: "Validating alternate entry points", ms: 420 },
  ]);

  doneBox("Navigation Plan", [
    `Feature: ${chalk.yellow(feature)}`,
    `Start: ${chalk.yellow(entryPoint)}`,
    "Steps: Top-right menu -> Profile (mock)",
  ]);
};

const runStatus = async () => {
  await runCinematicLoader([
    { label: "Pinging local modules", ms: 300 },
    { label: "Checking retrieval state", ms: 320 },
    { label: "Verifying action runtime", ms: 340 },
  ]);

  doneBox("CLI Status", [
    "Crawler: ready",
    "Retriever: ready",
    "Tool-caller: ready",
    "Config: not persisted yet (mock)",
  ]);
};

const main = async () => {
  await banner();

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "hello") {
    console.log(chalk.greenBright("Hello world from chatbot-package CLI!"));
    return;
  }

  if (command === "crawl") return runCrawl();
  if (command === "config") return runConfig();
  if (command === "ingest") return runIngest();
  if (command === "classify") return runClassify();
  if (command === "ask") return runAsk();
  if (command === "navigate") return runNavigate();
  if (command === "status") return runStatus();

  console.error(chalk.red(`Unknown command: ${command}`));
  printHelp();
  process.exitCode = 1;
};

main().catch((error) => {
  console.error(chalk.red("CLI failed:"), error);
  process.exit(1);
});
