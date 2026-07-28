import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the monorepo root (directory that contains packages/web, packages/core, bin/).
 * Walks up from `startDir` until the markers match. Prefer this over naive
 * package.json walks — packages/core also has its own package.json.
 */
export function resolveRepoRoot(
  startDir: string = typeof import.meta.url === "string"
    ? path.dirname(fileURLToPath(import.meta.url))
    : process.cwd()
): string {
  let dir = path.resolve(startDir);
  while (true) {
    if (
      existsSync(path.join(dir, "packages", "core")) &&
      existsSync(path.join(dir, "packages", "web")) &&
      existsSync(path.join(dir, "bin"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir);
}

export const REPO_ROOT: string = resolveRepoRoot();
