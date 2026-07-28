import type { CommandRunner } from "../process.js";
import { runCommand } from "../process.js";

export type RunResult = "passed" | "failed" | "blocked";

export interface WorkboardStatus {
  current_stage: string;
  terminal: boolean;
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

interface SuccessResponse {
  ok: true;
  status: WorkboardStatus;
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

export class WorkboardClient {
  constructor(
    private readonly executable = "herdr-workboard",
    private readonly runner: CommandRunner = runCommand,
  ) {}

  status(): Promise<WorkboardStatus> {
    return this.call(["status", "--json"]);
  }

  initialize(workflowPath: string, force = false): Promise<WorkboardStatus> {
    return this.call(["workflow", "init", workflowPath, ...(force ? ["--force"] : []), "--json"]);
  }

  transition(stage: string, requestId: string): Promise<WorkboardStatus> {
    return this.call(["transition", stage, "--request-id", requestId, "--json"]);
  }

  startRun(role: string): Promise<WorkboardStatus> {
    return this.call(["run", "start", role, "--json"]);
  }

  finishRun(role: string, result: RunResult): Promise<WorkboardStatus> {
    return this.call(["run", "finish", role, "--result", result, "--json"]);
  }

  private async call(args: string[]): Promise<WorkboardStatus> {
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
    return response.status;
  }
}
