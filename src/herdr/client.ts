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

interface WorkspaceCreateResult {
  result: { workspace: HerdrWorkspace; tab: { tab_id: string }; root_pane: HerdrPane };
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

  async createWorkspace(
    cwd: string,
    label: string,
    env: Record<string, string> = {},
  ): Promise<{ workspace: HerdrWorkspace; pane: HerdrPane }> {
    const environmentArgs = Object.entries(env).flatMap(([key, value]) => ["--env", `${key}=${value}`]);
    const created = await this.json<WorkspaceCreateResult>([
      "workspace", "create", "--cwd", cwd, "--label", label, ...environmentArgs, "--focus",
    ]);
    const pane = { ...created.result.root_pane, tab_id: created.result.tab.tab_id, label: "assistant" };
    await this.ok(["tab", "rename", created.result.tab.tab_id, "assistant"]);
    await this.ok(["pane", "rename", pane.pane_id, "assistant"]);
    return { workspace: created.result.workspace, pane };
  }

  async attachWorkboard(workspaceId: string, timeoutMs = 10_000): Promise<void> {
    await this.ok(["workspace", "focus", workspaceId]);
    await this.ok(["plugin", "action", "invoke", "phoobobo.workboard.attach"]);
    await this.waitForWorkspaceStable(workspaceId, timeoutMs);
  }

  private async waitForWorkspaceStable(workspaceId: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let stableSignature: string | undefined;
    let stableReads = 0;
    while (Date.now() < deadline) {
      const workspace = (await this.workspaces()).find((candidate) => candidate.workspace_id === workspaceId);
      if (workspace) {
        const ready = await this.workspaceStableRead(workspace, stableSignature, stableReads);
        stableSignature = ready.signature;
        stableReads = ready.stableReads;
        if (ready.done) return;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
    throw new Error("Timed out waiting for Workboard attachment");
  }

  private async workspaceStableRead(
    workspace: HerdrWorkspace,
    previousSignature: string | undefined,
    previousStableReads: number,
  ): Promise<{ signature: string; stableReads: number; done: boolean }> {
    const hasBoardPane = (await this.panes()).some(
      (pane) => pane.workspace_id === workspace.workspace_id && pane.label === "workboard",
    );
    const signature = `${workspace.pane_count ?? "?"}:${workspace.tab_count ?? "?"}`;
    const stableReads = hasBoardPane && signature === previousSignature ? previousStableReads + 1 : 0;
    return { signature, stableReads, done: stableReads >= 2 };
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
