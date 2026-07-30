import { describe, expect, it, vi } from "vitest";
import type { CommandRunner } from "../src/process.js";
import { WorkboardClient, WorkboardError } from "../src/workboard/client.js";

const status = { current_stage: "planning", terminal: false, current_runs: [], runs: [] };

describe("WorkboardClient", () => {
  it("uses the workspace-scoped JSON CLI contract", async () => {
    const runner = vi.fn<CommandRunner>(async () => ({
      stdout: JSON.stringify({ ok: true, status }),
      stderr: "",
      exitCode: 0,
    }));
    const client = new WorkboardClient("herdr-workboard", runner);

    await expect(client.transition("implementing", "msg-1")).resolves.toEqual(status);
    expect(runner).toHaveBeenCalledWith("herdr-workboard", [
      "transition", "implementing", "--request-id", "msg-1", "--json",
    ]);
  });

  it("preserves stable CLI errors", async () => {
    const runner: CommandRunner = async () => ({
      stdout: "",
      stderr: JSON.stringify({ ok: false, error: { code: "INVALID_TRANSITION", message: "not allowed" } }),
      exitCode: 4,
    });

    const error = await new WorkboardClient("herdr-workboard", runner)
      .transition("merged", "msg-2")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(WorkboardError);
    expect(error).toMatchObject({ code: "INVALID_TRANSITION", exitCode: 4, message: "not allowed" });
  });

  it("creates a task addressed at an explicit board", async () => {
    const task = {
      id: "t1", seq: 1, title: "Do it", state_id: "s1", state: "todo",
      pane_id: null, archived: false, created_at: 0, updated_at: 0,
    };
    const runner = vi.fn<CommandRunner>(async () => ({ stdout: JSON.stringify({ ok: true, task }), stderr: "", exitCode: 0 }));
    const client = new WorkboardClient("herdr-workboard", runner);

    await expect(client.createTask("Do it", { board: "b1" })).resolves.toEqual(task);
    expect(runner).toHaveBeenCalledWith("herdr-workboard", ["task", "add", "Do it", "--board", "b1", "--json"]);
  });

  it("creates a task addressed at an explicit workspace when no board id is known", async () => {
    const task = {
      id: "t1", seq: 1, title: "Do it", state_id: "s1", state: "todo",
      pane_id: null, archived: false, created_at: 0, updated_at: 0,
    };
    const runner = vi.fn<CommandRunner>(async () => ({ stdout: JSON.stringify({ ok: true, task }), stderr: "", exitCode: 0 }));
    const client = new WorkboardClient("herdr-workboard", runner);

    await expect(client.createTask("Do it", { workspace: "w2" })).resolves.toEqual(task);
    expect(runner).toHaveBeenCalledWith("herdr-workboard", ["task", "add", "Do it", "--workspace", "w2", "--json"]);
  });

  it("lists, moves, and archives tasks", async () => {
    const task = {
      id: "t1", seq: 1, title: "Do it", state_id: "s2", state: "doing",
      pane_id: null, archived: false, created_at: 0, updated_at: 0,
    };
    const runner = vi.fn<CommandRunner>(async (_command, args) => {
      if (args[1] === "list") return { stdout: JSON.stringify({ ok: true, tasks: [task] }), stderr: "", exitCode: 0 };
      return { stdout: JSON.stringify({ ok: true, task }), stderr: "", exitCode: 0 };
    });
    const client = new WorkboardClient("herdr-workboard", runner);

    await expect(client.listTasks({ all: true })).resolves.toEqual([task]);
    await expect(client.moveTask("t1", "doing")).resolves.toEqual(task);
    await expect(client.archiveTask("t1", true)).resolves.toEqual(task);
    expect(runner).toHaveBeenCalledWith("herdr-workboard", ["task", "list", "--all", "--json"]);
    expect(runner).toHaveBeenCalledWith("herdr-workboard", ["task", "move", "t1", "--state", "doing", "--json"]);
    expect(runner).toHaveBeenCalledWith("herdr-workboard", ["task", "archive", "t1", "--close-pane", "--json"]);
  });

  it("binds a workflow to a task on init", async () => {
    const runner = vi.fn<CommandRunner>(async () => ({ stdout: JSON.stringify({ ok: true, status }), stderr: "", exitCode: 0 }));
    const client = new WorkboardClient("herdr-workboard", runner);

    await expect(client.initialize("workflow.yaml", { taskId: "t1", board: "b1" })).resolves.toEqual(status);
    expect(runner).toHaveBeenCalledWith("herdr-workboard", [
      "workflow", "init", "workflow.yaml", "--task", "t1", "--board", "b1", "--json",
    ]);
  });
});
