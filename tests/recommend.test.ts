import { describe, expect, it } from "vitest";
import { recommendWorkdirs } from "../src/workdirs/recommend.js";
import type { WorkDirectory } from "../src/config/types.js";

const workdirs: WorkDirectory[] = [
  { path: "/repos/old", provider: "github", use_count: 20, last_used_at: "2025-01-01T00:00:00Z" },
  { path: "/repos/current", provider: "bits-codebase", use_count: 1, last_used_at: "2024-01-01T00:00:00Z" },
  { path: "/repos/recent", provider: "github", use_count: 2, last_used_at: "2026-01-01T00:00:00Z" },
];

describe("recommendWorkdirs", () => {
  it("prefers a registered repository containing cwd", () => {
    expect(recommendWorkdirs(workdirs, "/repos/current/packages/api")[0].path).toBe("/repos/current");
  });

  it("otherwise prefers recent use before frequency", () => {
    expect(recommendWorkdirs(workdirs, "/tmp")[0].path).toBe("/repos/recent");
  });
});
