import type { CommandRunner } from "../process.js";
import { runCommand } from "../process.js";

export type RunResult = "passed" | "failed" | "blocked";

export interface WorkboardStatus {
  current_stage: string;
  terminal: boolean;
  task_id?: string;
  card?: { task_id: string; state?: string; moved: boolean; reason?: string };
  current_runs: Array<{ id: string; role: string; status: "running" }>;
  runs: Array<{
    id: string;
    role: string;
    status: "running" | "finished";
    result?: RunResult;
    started_at: number;
    ended_at?: number;
  }>;
}

export interface TaskView {
  id: string;
  seq: number;
  title: string;
  body?: string;
  state_id: string;
  state: string;
  pane_id: string | null;
  agent_cmd?: string[];
  archived: boolean;
  created_at: number;
  updated_at: number;
}

interface SuccessResponse {
  ok: true;
  [key: string]: unknown;
}

interface ErrorResponse {
  ok: false;
  error: { code: string; message: string };
}

export class WorkboardError extends Error {
  constructor(public readonly code: string, message: string, public readonly exitCode: number) {
    super(message);
    this.name = "WorkboardError";
  }
}

export interface CreateTaskOptions {
  body?: string;
  state?: string;
  board?: string;
  workspace?: string;
}

export interface ListTasksOptions {
  state?: string;
  all?: boolean;
}

function addressingArgs(options: { board?: string; workspace?: string }): string[] {
  if (options.board) return ["--board", options.board];
  if (options.workspace) return ["--workspace", options.workspace];
  return [];
}

export class WorkboardClient {
  constructor(
    private readonly executable = "herdr-workboard",
    private readonly runner: CommandRunner = runCommand,
  ) {}

  status(): Promise<WorkboardStatus> {
    return this.callFor<WorkboardStatus>(["status", "--json"], "status");
  }

  initialize(
    workflowPath: string,
    options: { taskId?: string; force?: boolean; board?: string; workspace?: string } = {},
  ): Promise<WorkboardStatus> {
    return this.callFor<WorkboardStatus>([
      "workflow", "init", workflowPath,
      ...(options.taskId ? ["--task", options.taskId] : []),
      ...(options.force ? ["--force"] : []),
      ...addressingArgs(options),
      "--json",
    ], "status");
  }

  transition(stage: string, requestId: string): Promise<WorkboardStatus> {
    return this.callFor<WorkboardStatus>(["transition", stage, "--request-id", requestId, "--json"], "status");
  }

  startRun(role: string, requestId?: string): Promise<WorkboardStatus> {
    return this.callFor<WorkboardStatus>([
      "run", "start", role, ...(requestId ? ["--request-id", requestId] : []), "--json",
    ], "status");
  }

  finishRun(role: string, result: RunResult, requestId?: string): Promise<WorkboardStatus> {
    return this.callFor<WorkboardStatus>([
      "run", "finish", role, "--result", result, ...(requestId ? ["--request-id", requestId] : []), "--json",
    ], "status");
  }

  createTask(title: string, options: CreateTaskOptions = {}): Promise<TaskView> {
    return this.callFor<TaskView>([
      "task", "add", title,
      ...(options.body ? ["--body", options.body] : []),
      ...(options.state ? ["--state", options.state] : []),
      ...addressingArgs(options),
      "--json",
    ], "task");
  }

  listTasks(options: ListTasksOptions = {}): Promise<TaskView[]> {
    return this.callFor<TaskView[]>([
      "task", "list",
      ...(options.state ? ["--state", options.state] : []),
      ...(options.all ? ["--all"] : []),
      "--json",
    ], "tasks");
  }

  moveTask(task: string, state: string): Promise<TaskView> {
    return this.callFor<TaskView>(["task", "move", task, "--state", state, "--json"], "task");
  }

  archiveTask(task: string, closePane = false): Promise<TaskView> {
    return this.callFor<TaskView>([
      "task", "archive", task, ...(closePane ? ["--close-pane"] : []), "--json",
    ], "task");
  }

  private async callFor<T>(args: string[], field: string): Promise<T> {
    const response = await this.call(args);
    return response[field] as T;
  }

  private async call(args: string[]): Promise<Record<string, unknown>> {
    const result = await this.runner(this.executable, args);
    const text = result.exitCode === 0 ? result.stdout : result.stderr;
    let response: SuccessResponse | ErrorResponse;
    try {
      response = JSON.parse(text.trim()) as SuccessResponse | ErrorResponse;
    } catch {
      throw new WorkboardError("INVALID_RESPONSE", text.trim() || "herdr-workboard returned no JSON", result.exitCode);
    }
    if (result.exitCode !== 0 || !response.ok) {
      const error = response.ok ? { code: "COMMAND_FAILED", message: "herdr-workboard command failed" } : response.error;
      throw new WorkboardError(error.code, error.message, result.exitCode);
    }
    return response;
  }
}
