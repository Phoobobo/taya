#!/usr/bin/env node
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { initialize } from "./config/init.js";
import { loadConfig, loadWorkdirs } from "./config/load.js";
import { tayaHome } from "./config/paths.js";
import type { Provider, WorkDirectory } from "./config/types.js";
import { inspectDependencies, missingRequired } from "./dependencies.js";
import { HerdrClient } from "./herdr/client.js";
import { supervise } from "./supervisor.js";
import { addWorkdir } from "./workdirs/manage.js";
import { recommendWorkdirs } from "./workdirs/recommend.js";

const args = process.argv.slice(2);
const command = args[0]?.startsWith("-") ? "start" : (args.shift() ?? "start");

try {
  if (command === "init") await initCommand(args);
  else if (command === "workdir") await workdirCommand(args);
  else if (command === "doctor") doctorCommand(args);
  else if (command === "start") await startCommand(args);
  else if (command === "assistant") await assistantCommand(args);
  else if (command === "supervise") await superviseCommand(args);
  else if (command === "help" || command === "--help" || command === "-h") printHelp();
  else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  console.error(`taya: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

async function initCommand(commandArgs: string[]): Promise<void> {
  if (commandArgs.length > 0) throw new Error("init does not accept a repository; use 'taya workdir add <path>'");
  const home = await initialize();
  console.log(`Initialized Taya at ${home}`);
}

async function workdirCommand(commandArgs: string[]): Promise<void> {
  if (commandArgs[0] !== "add" || !commandArgs[1]) {
    throw new Error("Usage: taya workdir add <path> [--provider github|bits-codebase]");
  }
  const providerValue = option(commandArgs, "--provider");
  const provider = providerValue as Provider | undefined;
  if (provider && provider !== "github" && provider !== "bits-codebase") {
    throw new Error("--provider must be github or bits-codebase");
  }
  const home = tayaHome();
  if (!(await canRead(resolve(home, "config.yaml")))) await initialize();
  const workdir = await addWorkdir(home, commandArgs[1], provider);
  console.log(`Added ${workdir.path}${workdir.provider ? ` (${workdir.provider})` : ""}`);
}

function doctorCommand(commandArgs: string[]): void {
  const status = inspectDependencies();
  if (commandArgs.includes("--json")) {
    console.log(JSON.stringify(status));
    return;
  }
  for (const [name, available] of Object.entries(status)) {
    console.log(`${available ? "✓" : "✗"} ${name}`);
  }
  if (!status.workboard && status.herdr) {
    console.log("  install: herdr plugin install Phoobobo/herdr-workboard");
  }
  if (!status.workboardCli) {
    console.log("  CLI setup: in a herdr-workboard checkout, run 'bun install && bun link'");
  }
}

async function startCommand(commandArgs: string[]): Promise<void> {
  const home = tayaHome();
  if (!(await canRead(resolve(home, "config.yaml")))) {
    await initialize();
    console.log(`Initialized Taya at ${home}`);
  }
  await loadConfig(home);

  const status = inspectDependencies();
  const missing = missingRequired(status);
  if (missing.length > 0) {
    throw new Error(`Missing required dependencies: ${missing.join(", ")}. Run 'taya doctor'.`);
  }

  if (process.env.HERDR_ENV !== "1") {
    console.log("Opening persistent Herdr session 'taya'. Run taya again in its pane.");
    const child = spawn("herdr", ["--session", "taya"], { stdio: "inherit" });
    await new Promise<void>((resolvePromise, reject) => {
      child.once("error", reject);
      child.once("exit", () => resolvePromise());
    });
    return;
  }

  const configured = await loadWorkdirs(home);
  if (configured.length === 0) {
    throw new Error("No Work Directories configured. Run 'taya workdir add <path>'.");
  }
  const candidates = recommendWorkdirs(configured, process.cwd());
  const selected = commandArgs.includes("--yes") ? candidates[0] : await chooseWorkdir(candidates);
  if (!selected) throw new Error("No Work Directory selected");

  if (commandArgs.includes("--dry-run")) {
    console.log(JSON.stringify({ workdir: selected, herdrSession: "taya", profile: "assistant" }, null, 2));
    return;
  }

  const herdr = new HerdrClient();
  const workspace = await herdr.createIndependentWorkboard();
  const launcher = cliLauncher();
  const supervisorPane = await herdr.createNamedTab(
    workspace.workspace_id, "supervisor", selected.path, { TAYA_HOME: home }, false,
  );
  await herdr.runInPane(
    supervisorPane.pane_id,
    [...launcher, "supervise", "--workspace", workspace.workspace_id].map(shellQuote).join(" "),
  );
  const pane = await herdr.createNamedTab(
    workspace.workspace_id, "assistant", selected.path, { TAYA_HOME: home }, true,
  );
  const workflow = resolve(home, "workflows", "coding-standard.yaml");
  const bootstrap = [
    "herdr-workboard", "workflow", "init", workflow, "--json",
    "&&", ...launcher, "assistant", "--workdir", selected.path,
  ].map(shellQuote).join(" ").replace("'&&'", "&&");
  await herdr.runInPane(pane.pane_id, bootstrap);
  if (pane.tab_id) await herdr.focusTab(pane.tab_id);
  console.log(`Started Taya assistant in Herdr workspace ${workspace.workspace_id}`);
}

async function assistantCommand(commandArgs: string[]): Promise<void> {
  const home = tayaHome();
  const workdir = option(commandArgs, "--workdir");
  if (!workdir) throw new Error("assistant requires --workdir");
  const systemPrompt = await compileAssistantPrompt(home);
  const skill = resolve(home, "skills", "taya-herdr-communication", "SKILL.md");
  const piArgs = ["--system-prompt", systemPrompt, "--skill", skill, "--name", "taya"];
  const child = spawn("pi", piArgs, { cwd: workdir, stdio: "inherit", env: process.env });
  const exitCode = await new Promise<number>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolvePromise(code ?? 1));
  });
  process.exitCode = exitCode;
}

async function superviseCommand(commandArgs: string[]): Promise<void> {
  const workspaceId = option(commandArgs, "--workspace");
  if (!workspaceId) throw new Error("supervise requires --workspace");
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  console.log(`Supervising Herdr workspace ${workspaceId}`);
  await supervise(workspaceId, controller.signal);
}

async function chooseWorkdir(candidates: WorkDirectory[]): Promise<WorkDirectory | undefined> {
  if (!stdin.isTTY || !stdout.isTTY) return candidates[0];
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    console.log("Select Work Directory:");
    candidates.forEach((item, index) => {
      const provider = item.provider ? ` (${item.provider})` : "";
      console.log(`  ${index + 1}. ${item.path}${provider}`);
    });
    const answer = (await rl.question("Choice [1]: ")).trim();
    const index = answer === "" ? 0 : Number(answer) - 1;
    return Number.isInteger(index) ? candidates[index] : undefined;
  } finally {
    rl.close();
  }
}

async function compileAssistantPrompt(home: string): Promise<string> {
  const files = [
    resolve(home, "assistant", "SYSTEM.md"),
    resolve(home, "assistant", "personality.yaml"),
    resolve(home, "assistant", "engineering.yaml"),
  ];
  const [system, personality, engineering] = await Promise.all(files.map((path) => readFile(path, "utf8")));
  return `${system.trim()}\n\n# Personality\n\n${personality.trim()}\n\n# Engineering preferences\n\n${engineering.trim()}`;
}

async function canRead(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function option(commandArgs: string[], name: string): string | undefined {
  const index = commandArgs.indexOf(name);
  if (index === -1) return undefined;
  const value = commandArgs[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function cliLauncher(): string[] {
  const entry = resolve(process.argv[1]);
  return entry.endsWith(".ts") ? ["npx", "tsx", entry] : [process.execPath, entry];
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function printHelp(): void {
  console.log(`taya - True Assistant\n\nUsage:\n  taya [start] [--yes] [--dry-run]\n  taya init\n  taya workdir add <path> [--provider github|bits-codebase]\n  taya doctor [--json]\n`);
}
