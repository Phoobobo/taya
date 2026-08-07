#!/usr/bin/env node
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { initialize } from "./config/init.js";
import { loadConfig, loadWorkdirs } from "./config/load.js";
import { resourcesDir, tayaHome } from "./config/paths.js";
import type { Provider, WorkDirectory } from "./config/types.js";
import { inspectDependencies, missingRequired } from "./dependencies.js";
import { HerdrClient } from "./herdr/client.js";
import { DEFAULT_INTERVAL_MS, schedule } from "./scheduler.js";
import { addWorkdir } from "./workdirs/manage.js";
import { recommendWorkdirs } from "./workdirs/recommend.js";
import { WorkboardClient } from "./workboard/client.js";
import {
  composeAgentPrompt,
  loadAgentProfile,
  loadRoleSystemPrompt,
  resolveSkills,
  type StageContract,
} from "./agents.js";

/** Communication is how the assistant talks; delegation is how it puts work on other roles. */
const ASSISTANT_SKILLS = ["taya-herdr-communication", "taya-delegation"];

const args = process.argv.slice(2);
const command = args[0]?.startsWith("-") ? "start" : (args.shift() ?? "start");

try {
  if (command === "init") await initCommand(args);
  else if (command === "workdir") await workdirCommand(args);
  else if (command === "doctor") doctorCommand(args);
  else if (command === "start") await startCommand(args);
  else if (command === "assistant") await assistantCommand(args);
  else if (command === "agent") await agentCommand(args);
  else if (command === "scheduler") await schedulerCommand(args);
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
  const config = await loadConfig(home);

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
  const workboard = new WorkboardClient();
  const created = await herdr.createWorkspace(
    selected.path,
    `Taya · ${basename(selected.path)}`,
    { TAYA_HOME: home },
  );
  const { workspace, pane } = created;
  await herdr.attachWorkboard(workspace.workspace_id);
  const task = await workboard.createTask(
    `Engineering task in ${basename(selected.path)}`,
    { workspace: workspace.workspace_id },
  );
  const launcher = cliLauncher();
  const workflow = resolve(home, "workflows", `${config.default_workflow}.yaml`);
  const bootstrap = [
    "herdr-workboard", "workflow", "init", workflow, "--task", task.id, "--json",
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
  // Same user-over-package layering the professional roles get, so an override
  // wins and a deleted copy falls back instead of breaking the launch.
  const { paths, missing } = await resolveSkills(home, ASSISTANT_SKILLS);
  for (const name of missing) console.error(`taya: skill '${name}' not found; launching without it`);
  const piArgs = [
    "--system-prompt", systemPrompt,
    ...paths.flatMap((path) => ["--skill", path]),
    "--prompt-template", resolve(home, "prompt-templates"),
    "--prompt-template", resolve(resourcesDir(), "prompt-templates"),
    "--name", "taya",
  ];
  const child = spawn("pi", piArgs, { cwd: workdir, stdio: "inherit", env: process.env });
  const exitCode = await new Promise<number>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolvePromise(code ?? 1));
  });
  process.exitCode = exitCode;
}

async function agentCommand(commandArgs: string[]): Promise<void> {
  const home = tayaHome();
  const role = option(commandArgs, "--role");
  const workdir = option(commandArgs, "--workdir");
  if (!role) throw new Error("agent requires --role");
  if (!workdir) throw new Error("agent requires --workdir");

  const profile = await loadAgentProfile(home, role);
  const [contract, engineering, system] = await Promise.all([
    readAgentContract(home),
    readFile(resolve(home, "assistant", "engineering.yaml"), "utf8"),
    loadRoleSystemPrompt(home, role, profile),
  ]);

  // The stage contract is best effort: an agent launched into a workspace with
  // no workflow bound is still a usable agent, just one without stage context.
  const stage = await currentStage(role).catch(() => undefined);
  const systemPrompt = composeAgentPrompt({ contract, engineering, system, profile, stage });

  const { paths, missing } = await resolveSkills(home, profile.skills ?? []);
  for (const name of missing) console.error(`taya: skill '${name}' not found; launching without it`);

  const piArgs = [
    "--system-prompt", systemPrompt,
    ...paths.flatMap((path) => ["--skill", path]),
    ...(profile.tools?.length ? ["--tools", profile.tools.join(",")] : []),
    ...(profile.model?.thinking ? ["--thinking", profile.model.thinking] : []),
    "--name", `taya-${role}`,
  ];
  const child = spawn("pi", piArgs, { cwd: workdir, stdio: "inherit", env: process.env });
  const exitCode = await new Promise<number>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolvePromise(code ?? 1));
  });
  process.exitCode = exitCode;
}

/**
 * The contract every professional role receives, whatever its role. Named for
 * what it is rather than `agent.md`, which would read as one role's prompt
 * beside `assistant.md` and would squat the name a per-role prompt may want.
 */
async function readAgentContract(home: string): Promise<string> {
  const userPath = resolve(home, "prompts", "agent-contract.md");
  return readFile(
    (await canRead(userPath)) ? userPath : resolve(resourcesDir(), "prompts", "agent-contract.md"),
    "utf8",
  );
}

/** The stage this role is being launched into, if a workflow is bound to the task. */
async function currentStage(role: string): Promise<StageContract | undefined> {
  const workflow = await new WorkboardClient().showWorkflow();
  const stage = workflow.stages.find((candidate) => candidate.name === workflow.current_stage);
  return stage?.agent === role ? stage : undefined;
}

async function schedulerCommand(commandArgs: string[]): Promise<void> {
  const workspaceId = option(commandArgs, "--workspace");
  if (!workspaceId) throw new Error("scheduler requires --workspace");
  const intervalValue = option(commandArgs, "--interval");
  const intervalMs = intervalValue === undefined ? DEFAULT_INTERVAL_MS : Number(intervalValue);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("--interval must be a positive number of milliseconds");
  }
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  console.log(`Scheduling pick checks for Herdr workspace ${workspaceId} every ${intervalMs}ms`);
  await schedule(workspaceId, intervalMs, controller.signal);
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
  console.log(`taya - True Assistant\n\nUsage:\n  taya [start] [--yes] [--dry-run]\n  taya init\n  taya workdir add <path> [--provider github|bits-codebase]\n  taya doctor [--json]\n  taya agent --role <role> --workdir <path>\n  taya scheduler --workspace <id> [--interval <ms>]\n`);
}
