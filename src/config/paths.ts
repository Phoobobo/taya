import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function tayaHome(env: NodeJS.ProcessEnv = process.env): string {
  return resolve(env.TAYA_HOME ?? resolve(homedir(), ".taya"));
}

export function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

export function resourcesDir(): string {
  return resolve(packageRoot(), "resources");
}
