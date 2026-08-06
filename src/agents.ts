import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { resourcesDir } from "./config/paths.js";

export interface AgentProfile {
  name: string;
  description?: string;
  model?: { inherit?: boolean; thinking?: string };
  tools?: string[];
  skills?: string[];
  constraints?: string[];
  prompt?: string;
}

export interface StageContract {
  name: string;
  agent: string;
  output?: string;
  success_message?: string;
  retry_message?: string;
  retry_to?: string;
}

export interface AgentPromptParts {
  contract: string;
  engineering: string;
  system: string;
  profile: AgentProfile;
  stage?: StageContract;
}

/**
 * Assemble the prompt in the order the architecture specifies: shared contract,
 * engineering preferences, role identity, role constraints, then the contract
 * for the stage the agent is being launched into.
 *
 * Constraints are restated here even though they also live in profile.yaml,
 * because the profile is configuration Taya reads — the agent only ever sees
 * what lands in this string.
 */
export function composeAgentPrompt(parts: AgentPromptParts): string {
  const sections = [
    parts.contract.trim(),
    `# Engineering preferences\n\n${parts.engineering.trim()}`,
    `# Your role\n\n${parts.system.trim()}`,
  ];

  const constraints = parts.profile.constraints ?? [];
  if (constraints.length > 0) {
    sections.push(`# Your constraints\n\n${constraints.map((c) => `- ${c}`).join("\n")}`);
  }

  if (parts.stage) {
    sections.push(`# Current stage\n\n${describeStage(parts.stage)}`);
  }

  return sections.join("\n\n");
}

function describeStage(stage: StageContract): string {
  const lines = [`You are running the \`${stage.name}\` stage.`];
  if (stage.output) lines.push(`Write your findings to \`${stage.output}\`.`);
  if (stage.success_message) lines.push(`On success, report \`${stage.success_message}\` to the assistant.`);
  if (stage.retry_message) {
    const target = stage.retry_to ? ` The task returns to \`${stage.retry_to}\`.` : "";
    lines.push(`If the work does not pass, report \`${stage.retry_message}\` instead.${target}`);
  }
  return lines.join("\n");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a role file from the user's directory first, falling back to the
 * package. Same layering as prompt templates: an override wins, and a missing
 * or deleted user copy falls back instead of breaking the launch.
 */
async function resolveRoleFile(home: string, role: string, file: string): Promise<string | undefined> {
  for (const base of [resolve(home, "agents"), resolve(resourcesDir(), "agents")]) {
    const path = resolve(base, role, file);
    if (await exists(path)) return path;
  }
  return undefined;
}

export async function loadAgentProfile(home: string, role: string): Promise<AgentProfile> {
  const path = await resolveRoleFile(home, role, "profile.yaml");
  if (!path) throw new Error(`Unknown agent role '${role}': no profile.yaml under agents/${role}`);
  const value = parse(await readFile(path, "utf8")) as Partial<AgentProfile> | null;
  if (!value || typeof value !== "object" || typeof value.name !== "string") {
    throw new Error(`Invalid agent profile: ${path}`);
  }
  return value as AgentProfile;
}

export async function loadRoleSystemPrompt(home: string, role: string, profile: AgentProfile): Promise<string> {
  const path = await resolveRoleFile(home, role, profile.prompt ?? "SYSTEM.md");
  if (!path) throw new Error(`Agent role '${role}' has no ${profile.prompt ?? "SYSTEM.md"}`);
  return readFile(path, "utf8");
}

/**
 * Map a profile's skill names to readable paths, user directory first. A name
 * that resolves nowhere is dropped rather than passed on — handing a harness a
 * path that does not exist is worse than launching without the skill.
 */
export async function resolveSkills(
  home: string,
  names: string[],
): Promise<{ paths: string[]; missing: string[] }> {
  const paths: string[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const candidates = [
      resolve(home, "skills", name, "SKILL.md"),
      resolve(resourcesDir(), "skills", name, "SKILL.md"),
    ];
    const found = await Promise.all(candidates.map(exists));
    const index = found.indexOf(true);
    if (index === -1) missing.push(name);
    else paths.push(candidates[index]);
  }
  return { paths, missing };
}
