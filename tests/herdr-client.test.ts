import { describe, expect, it, vi } from "vitest";
import { HerdrClient } from "../src/herdr/client.js";
import type { CommandRunner } from "../src/process.js";

function result(value: unknown) {
  return { stdout: JSON.stringify(value), stderr: "", exitCode: 0 };
}

describe("HerdrClient", () => {
  it("resolves a named pane within the current workspace and sends text", async () => {
    const runner = vi.fn<CommandRunner>(async (_command, args) => {
      if (args.join(" ") === "pane current") return result({ result: { pane: { pane_id: "p1", workspace_id: "w1" } } });
      if (args.join(" ") === "pane list") return result({ result: { panes: [
        { pane_id: "p2", workspace_id: "w1", label: "assistant" },
        { pane_id: "p3", workspace_id: "w2", label: "assistant" },
      ] } });
      return { stdout: "", stderr: "", exitCode: 0 };
    });

    await new HerdrClient(runner).send("assistant", "hello");

    expect(runner).toHaveBeenNthCalledWith(3, "herdr", ["pane", "send-text", "p2", "hello"]);
    expect(runner).toHaveBeenNthCalledWith(4, "herdr", ["pane", "send-keys", "p2", "Enter"]);
  });

  it("creates an assistant-first workspace before attaching Workboard", async () => {
    let workspaceReads = 0;
    const runner = vi.fn<CommandRunner>(async (_command, args) => {
      if (args[0] === "workspace" && args[1] === "create") {
        return result({ result: {
          workspace: { workspace_id: "w2" },
          tab: { tab_id: "t1" },
          root_pane: { pane_id: "p1", workspace_id: "w2" },
        } });
      }
      if (args.join(" ") === "workspace list") {
        workspaceReads += 1;
        return result({ result: { workspaces: [{ workspace_id: "w2", pane_count: 6, tab_count: 6 }] } });
      }
      if (args.join(" ") === "pane list") {
        return result({ result: { panes: [
          { pane_id: "p1", workspace_id: "w2", tab_id: "t1", label: "assistant" },
          { pane_id: "board", workspace_id: "w2", label: "workboard" },
        ] } });
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const client = new HerdrClient(runner);

    const created = await client.createWorkspace("/repo", "Taya · repo", { TAYA_HOME: "/tmp/profile" });
    await client.attachWorkboard("w2", 1_000);

    expect(created.pane).toMatchObject({ pane_id: "p1", tab_id: "t1", label: "assistant" });
    expect(runner).toHaveBeenCalledWith("herdr", ["tab", "rename", "t1", "assistant"]);
    expect(runner).toHaveBeenCalledWith("herdr", [
      "plugin", "action", "invoke", "phoobobo.workboard.attach",
    ]);
    expect(workspaceReads).toBeGreaterThanOrEqual(3);
  });

  it("creates a named role tab in a workspace", async () => {
    const runner = vi.fn<CommandRunner>(async (_command, args) => {
      if (args[0] === "tab") {
        return result({ result: { root_pane: { pane_id: "p4", workspace_id: "w2" } } });
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const client = new HerdrClient(runner);

    await expect(client.createNamedTab("w2", "assistant", "/repo")).resolves.toMatchObject({
      pane_id: "p4",
      label: "assistant",
    });
    expect(runner).toHaveBeenCalledWith("herdr", ["pane", "rename", "p4", "assistant"]);
  });

  it("rejects ambiguous labels in one workspace", async () => {
    const runner: CommandRunner = async (_command, args) => {
      if (args[1] === "current") return result({ result: { pane: { pane_id: "p1", workspace_id: "w1" } } });
      return result({ result: { panes: [
        { pane_id: "p2", workspace_id: "w1", label: "qa" },
        { pane_id: "p3", workspace_id: "w1", label: "qa" },
      ] } });
    };

    await expect(new HerdrClient(runner).findNamedPane("qa")).rejects.toThrow("ambiguous");
  });
});
