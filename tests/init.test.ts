import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initialize } from "../src/config/init.js";
import { loadConfig, loadWorkdirs } from "../src/config/load.js";
import { addWorkdir } from "../src/workdirs/manage.js";

const homes: string[] = [];

afterEach(async () => {
  await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })));
});

describe("initialize", () => {
  it("creates readable default configuration without secrets", async () => {
    const home = await mkdtemp(resolve(tmpdir(), "taya-test-"));
    homes.push(home);

    await initialize({ home });

    expect(await loadConfig(home)).toMatchObject({ version: 1, herdr_session: "taya" });
    expect(await loadWorkdirs(home)).toEqual([]);
    await addWorkdir(home, "/repos/project", "bits-codebase");
    expect(await loadWorkdirs(home)).toEqual([
      { path: "/repos/project", provider: "bits-codebase", use_count: 0 },
    ]);
    expect(await readFile(resolve(home, "agents", "coder", "SYSTEM.md"), "utf8")).toContain("Taya's coder");
  });
});
