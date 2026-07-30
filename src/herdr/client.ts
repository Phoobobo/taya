import type { CommandRunner } from "../process.js";
import { runCommand } from "../process.js";

export interface HerdrPane {
  pane_id: string;
  workspace_id: string;
  tab_id?: string;
  label?: string;
  agent_status?: "idle" | "working" | "blocked" | "done" | "unknown";
}

interface PaneResult {
  result: { pane: HerdrPane };
}

interface PaneListResult {
  result: { panes: HerdrPane[] };
}

export interface HerdrWorkspace {
  workspace_id: string;
  label?: string;
  focused?: boolean;
  pane_count?: number;
  tab_count?: number;
}

interface WorkspaceListResult {
  result: { workspaces: HerdrWorkspace[] };
}

interface TabCreateResult {
  result: { tab?: { tab_id: string }; root_pane: HerdrPane };
}

export class HerdrClient {
  constructor(private readonly runner: CommandRunner = runCommand) {}

  async currentPane(): Promise<HerdrPane> {
    return (await this.json<PaneResult>(["pane", "current"])).result.pane;
  }

  async panes(): Promise<HerdrPane[]> {
    return (await this.json<PaneListResult>(["pane", "list"])).result.panes;
  }

  async workspaces(): Promise<HerdrWorkspace[]> {
    return (await this.json<WorkspaceListResult>(["workspace", "list"])).result.workspaces;
  }

  async createNamedTab(
    workspaceId: string,
    label: string,
    cwd: string,
    env: Record<string, string> = {},
    focus = false,
  ): Promise<HerdrPane> {
    const environmentArgs = Object.entries(env).flatMap(([key, value]) => ["--env", `${key}=${value}`]);
    const created = await this.json<TabCreateResult>([
      "tab", "create", "--workspace", workspaceId, "--cwd", cwd, "--label", label,
      ...environmentArgs, focus ? "--focus" : "--no-focus",
    ]);
    const pane = created.result.root_pane;
    await this.ok(["pane", "rename", pane.pane_id, label]);
    return { ...pane, tab_id: pane.tab_id ?? created.result.tab?.tab_id, label };
  }

  async runInPane(paneId: string, command: string): Promise<void> {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
    await this.ok(["pane", "run", paneId, command]);
  }

  async focusTab(tabId: string): Promise<void> {
    await this.ok(["tab", "focus", tabId]);
  }

  async findNamedPane(label: string, workspaceId?: string): Promise<HerdrPane> {
    const targetWorkspace = workspaceId ?? (await this.currentPane()).workspace_id;
    const matches = (await this.panes()).filter(
      (pane) => pane.workspace_id === targetWorkspace && pane.label === label,
    );
    if (matches.length === 0) throw new Error(`Herdr pane '${label}' not found in workspace ${targetWorkspace}`);
    if (matches.length > 1) throw new Error(`Herdr pane '${label}' is ambiguous in workspace ${targetWorkspace}`);
    return matches[0];
  }

  async send(label: string, text: string, workspaceId?: string): Promise<void> {
    const pane = await this.findNamedPane(label, workspaceId);
    await this.ok(["pane", "send-text", pane.pane_id, text]);
    await this.ok(["pane", "send-keys", pane.pane_id, "Enter"]);
  }

  private async json<T>(args: string[]): Promise<T> {
    const result = await this.runner("herdr", args);
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `herdr ${args.join(" ")} failed`);
    try {
      return JSON.parse(result.stdout) as T;
    } catch {
      throw new Error(`herdr ${args.join(" ")} returned invalid JSON`);
    }
  }

  private async ok(args: string[]): Promise<void> {
    const result = await this.runner("herdr", args);
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `herdr ${args.join(" ")} failed`);
  }
}
