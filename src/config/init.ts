import { constants } from "node:fs";
import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { resourcesDir, tayaHome } from "./paths.js";
import type { TayaConfig, WorkdirsDocument } from "./types.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  if (!(await exists(path))) await writeFile(path, content, "utf8");
}

export interface InitOptions {
  home?: string;
}

export async function initialize(options: InitOptions = {}): Promise<string> {
  const home = resolve(options.home ?? tayaHome());
  await mkdir(resolve(home, "assistant"), { recursive: true });
  await mkdir(resolve(home, "agents"), { recursive: true });
  await mkdir(resolve(home, "workflows"), { recursive: true });
  await mkdir(resolve(home, "skills"), { recursive: true });
  await mkdir(resolve(home, "prompt-templates"), { recursive: true });

  const source = resourcesDir();
  await cp(resolve(source, "agents"), resolve(home, "agents"), { recursive: true, force: false, errorOnExist: false });
  await cp(resolve(source, "workflows"), resolve(home, "workflows"), { recursive: true, force: false, errorOnExist: false });
  await cp(resolve(source, "skills"), resolve(home, "skills"), { recursive: true, force: false, errorOnExist: false });
  await cp(
    resolve(source, "prompt-templates"),
    resolve(home, "prompt-templates"),
    { recursive: true, force: false, errorOnExist: false },
  );

  const assistantPrompt = await readFile(resolve(source, "prompts", "assistant.md"), "utf8");
  await writeIfMissing(resolve(home, "assistant", "SYSTEM.md"), assistantPrompt);
  await writeIfMissing(resolve(home, "assistant", "personality.yaml"), stringify({ name: "Taya", tone: "concise and direct" }));
  await writeIfMissing(resolve(home, "assistant", "engineering.yaml"), stringify({ prefer_small_changes: true, require_tests: true }));

  const config: TayaConfig = { version: 1, herdr_session: "taya", default_workflow: "coding-standard" };
  await writeIfMissing(resolve(home, "config.yaml"), stringify(config));

  const workdirs: WorkdirsDocument = { workdirs: [] };
  await writeIfMissing(resolve(home, "assistant", "workdirs.yaml"), stringify(workdirs));
  return home;
}
