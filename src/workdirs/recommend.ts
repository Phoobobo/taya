import { relative, resolve } from "node:path";
import type { WorkDirectory } from "../config/types.js";

function contains(parent: string, child: string): boolean {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (!path.startsWith("..") && !path.startsWith("/"));
}

function timestamp(value?: string): number {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function recommendWorkdirs(workdirs: WorkDirectory[], cwd: string): WorkDirectory[] {
  return [...workdirs].sort((left, right) => {
    const currentDifference = Number(contains(right.path, cwd)) - Number(contains(left.path, cwd));
    if (currentDifference !== 0) return currentDifference;
    const recentDifference = timestamp(right.last_used_at) - timestamp(left.last_used_at);
    if (recentDifference !== 0) return recentDifference;
    return right.use_count - left.use_count;
  });
}
