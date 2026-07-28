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
});
