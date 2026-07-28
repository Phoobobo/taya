import { describe, expect, it } from "vitest";
import { statusChanges } from "../src/supervisor.js";

describe("statusChanges", () => {
  it("reports worker transitions in the target workspace only", () => {
    const changes = statusChanges([
      { pane_id: "p1", workspace_id: "w1", label: "coder", agent_status: "done" },
      { pane_id: "p2", workspace_id: "w1", label: "assistant", agent_status: "working" },
      { pane_id: "p3", workspace_id: "w2", label: "qa", agent_status: "blocked" },
    ], new Map([["coder", "working"]]), "w1");

    expect(changes).toEqual([{ role: "coder", previous: "working", current: "done" }]);
  });
});
