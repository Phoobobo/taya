import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { composeAgentPrompt, loadAgentProfile, resolveSkills } from "../src/agents.js";

const homes: string[] = [];

afterEach(async () => {
  await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })));
});

async function scratchHome(): Promise<string> {
  const home = await mkdtemp(resolve(tmpdir(), "taya-agents-"));
  homes.push(home);
  return home;
}

describe("composeAgentPrompt", () => {
  const base = {
    contract: "# Contract\n\nRoute through the assistant.",
    engineering: "require_tests: true",
    system: "You are Taya's executor.",
    profile: { name: "executor", constraints: ["Do not merge the MR."] },
  };

  it("orders the sections the way the architecture specifies", () => {
    const prompt = composeAgentPrompt(base);

    expect(prompt.indexOf("Route through the assistant"))
      .toBeLessThan(prompt.indexOf("require_tests"));
    expect(prompt.indexOf("require_tests"))
      .toBeLessThan(prompt.indexOf("You are Taya's executor"));
    expect(prompt.indexOf("You are Taya's executor"))
      .toBeLessThan(prompt.indexOf("Do not merge the MR."));
  });

  it("renders the stage contract when the agent is launched into one", () => {
    const prompt = composeAgentPrompt({
      ...base,
      stage: {
        name: "review",
        agent: "reviewer",
        output: ".taya/review.md",
        success_message: "review.approved",
        retry_message: "review.changes_requested",
        retry_to: "implementing",
      },
    });

    expect(prompt).toContain("`review` stage");
    expect(prompt).toContain(".taya/review.md");
    expect(prompt).toContain("review.approved");
    expect(prompt).toContain("returns to `implementing`");
  });

  it("omits the stage section entirely when no workflow is bound", () => {
    expect(composeAgentPrompt(base)).not.toContain("# Current stage");
  });

  it("omits constraints when the profile lists none", () => {
    expect(composeAgentPrompt({ ...base, profile: { name: "executor" } }))
      .not.toContain("# Your constraints");
  });
});

describe("loadAgentProfile", () => {
  it("falls back to the shipped profile when the user has no override", async () => {
    const profile = await loadAgentProfile(await scratchHome(), "executor");
    expect(profile.name).toBe("executor");
    expect(profile.constraints?.length).toBeGreaterThan(0);
  });

  it("prefers a user override over the shipped profile", async () => {
    const home = await scratchHome();
    await mkdir(resolve(home, "agents", "executor"), { recursive: true });
    await writeFile(resolve(home, "agents", "executor", "profile.yaml"), "name: executor\ntools: [read]\n");

    expect((await loadAgentProfile(home, "executor")).tools).toEqual(["read"]);
  });

  it("names the role when it does not exist", async () => {
    await expect(loadAgentProfile(await scratchHome(), "nope")).rejects.toThrow("nope");
  });
});

describe("resolveSkills", () => {
  it("resolves shipped skills and reports ones it cannot find", async () => {
    const { paths, missing } = await resolveSkills(await scratchHome(), [
      "taya-herdr-communication",
      "not-a-real-skill",
    ]);

    // A skill that resolves nowhere is dropped rather than passed to the
    // harness as a broken path.
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain("taya-herdr-communication");
    expect(missing).toEqual(["not-a-real-skill"]);
  });
});
