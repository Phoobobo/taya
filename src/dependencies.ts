import { spawnSync } from "node:child_process";

export interface DependencyStatus {
  pi: boolean;
  herdr: boolean;
  workboard: boolean;
  workboardCli: boolean;
  gh: boolean;
  bitscli: boolean;
}

function commandExists(command: string): boolean {
  return spawnSync("/usr/bin/env", ["sh", "-c", `command -v ${command}`], { stdio: "ignore" }).status === 0;
}

function hasWorkboardPlugin(): boolean {
  if (!commandExists("herdr")) return false;
  const result = spawnSync("herdr", ["plugin", "list"], { encoding: "utf8" });
  return result.status === 0 && result.stdout.includes("phoobobo.workboard");
}

export function inspectDependencies(): DependencyStatus {
  return {
    pi: commandExists("pi"),
    herdr: commandExists("herdr"),
    workboard: hasWorkboardPlugin(),
    workboardCli: commandExists("herdr-workboard"),
    gh: commandExists("gh"),
    bitscli: commandExists("bitscli"),
  };
}

export function missingRequired(status: DependencyStatus): string[] {
  return (["pi", "herdr", "workboard", "workboardCli"] as const).filter((name) => !status[name]);
}
