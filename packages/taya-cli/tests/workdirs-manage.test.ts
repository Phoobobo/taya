import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initialize } from "../src/config/init.js";
import { loadWorkdirs } from "../src/config/load.js";
import { addWorkdir } from "../src/workdirs/manage.js";

const homes: string[] = [];

afterEach(async () => {
  await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })));
});

describe("addWorkdir", () => {
  it("registers a local directory without requiring Git or a remote provider", async () => {
    const home = await mkdtemp(resolve(tmpdir(), "taya-workdirs-"));
    homes.push(home);
    await initialize({ home });

    await addWorkdir(home, "/tmp/local-notes");

    expect(await loadWorkdirs(home)).toEqual([
      { path: "/tmp/local-notes", use_count: 0 },
    ]);
  });
});
