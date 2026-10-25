import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { tayaHome } from "./paths.js";
import type { TayaConfig, WorkDirectory, WorkdirsDocument } from "./types.js";

async function readYaml(path: string): Promise<unknown> {
  return parse(await readFile(path, "utf8"));
}

export async function loadConfig(home = tayaHome()): Promise<TayaConfig> {
  const value = await readYaml(resolve(home, "config.yaml"));
  if (!value || typeof value !== "object" || (value as TayaConfig).version !== 1) {
    throw new Error(`Invalid Taya config: ${resolve(home, "config.yaml")}`);
  }
  return value as TayaConfig;
}

function isWorkDirectory(value: unknown): value is WorkDirectory {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WorkDirectory>;
  return typeof item.path === "string"
    && (item.provider === undefined || item.provider === "github" || item.provider === "bits-codebase")
    && typeof item.use_count === "number";
}

export async function loadWorkdirs(home = tayaHome()): Promise<WorkDirectory[]> {
  const value = await readYaml(resolve(home, "assistant", "workdirs.yaml")) as Partial<WorkdirsDocument>;
  if (!Array.isArray(value?.workdirs) || !value.workdirs.every(isWorkDirectory)) {
    throw new Error(`Invalid Work Directory config under ${home}`);
  }
  return value.workdirs;
}
