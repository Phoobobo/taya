import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { loadWorkdirs } from "../config/load.js";
import type { Provider, WorkDirectory, WorkdirsDocument } from "../config/types.js";
import { runCommand } from "../process.js";

export async function detectProvider(path: string): Promise<Provider> {
  const result = await runCommand("git", ["-C", resolve(path), "remote", "get-url", "origin"]);
  if (result.exitCode !== 0) throw new Error(`Cannot read origin remote for ${resolve(path)}`);
  const remote = result.stdout.trim().toLowerCase();
  if (remote.includes("github.com")) return "github";
  if (remote.includes("code.byted.org")) return "bits-codebase";
  throw new Error(`Cannot detect provider from origin remote: ${result.stdout.trim()}`);
}

export async function addWorkdir(home: string, path: string, provider?: Provider): Promise<WorkDirectory> {
  const absolute = resolve(path);
  const workdirs = await loadWorkdirs(home);
  const existing = workdirs.find((item) => item.path === absolute);
  if (existing) {
    if (provider) existing.provider = provider;
    await save(home, workdirs);
    return existing;
  }
  const item: WorkDirectory = {
    path: absolute,
    ...(provider ? { provider } : {}),
    use_count: 0,
  };
  workdirs.push(item);
  await save(home, workdirs);
  return item;
}

async function save(home: string, workdirs: WorkDirectory[]): Promise<void> {
  const document: WorkdirsDocument = { workdirs };
  await writeFile(resolve(home, "assistant", "workdirs.yaml"), stringify(document), "utf8");
}
