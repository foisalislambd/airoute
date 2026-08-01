#!/usr/bin/env node

import fs from "node:fs/promises";
import { mkdirSync, existsSync as fsExistsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  assembleStandalone,
  syncStandaloneNativeAssets as _syncNativeAssets,
  syncStandaloneExtraModules as _syncExtraModules,
} from "./assembleStandalone.mjs";
import {
  isBackendOnlyBuild,
  stubDashboardPages,
  restoreDashboardPages,
} from "./backendOnlyPages.mjs";

/**
 * Layer 1: `app/` has been renamed to `dist/` and the App-Router collision is gone.
 * The only transient paths remaining are `.tmp/wine32` (Wine prefix used by some
 * older build tools) and `_tasks` (planning workspace).
 */

const projectRoot = process.cwd();
const webDir = path.join(projectRoot, "packages", "web");
const isMonorepoWeb = fsExistsSync(path.join(webDir, "next.config.mjs"));

/** Relative distDir name Next accepts inside packages/web (no `..`, not absolute). */
function webRelativeDistDir(env = process.env) {
  const raw = env.NEXT_DIST_DIR;
  if (raw && !path.isAbsolute(raw) && !raw.split(/[\\/]/).includes("..")) {
    return raw;
  }
  return ".build/next";
}

/**
 * Where `next build` (cwd=packages/web) actually writes output.
 * Absolute repo-root paths are invalid for Next distDir in this monorepo layout.
 */
const nextDistDir = isMonorepoWeb
  ? path.join(webDir, webRelativeDistDir())
  : path.resolve(process.env.NEXT_DIST_DIR || ".build/next");

/** Repo-root location expected by Dockerfile / prepublish / pack scripts. */
const distDir = path.resolve(projectRoot, process.env.NEXT_DIST_DIR || ".build/next");
const backupRoot = path.join(os.tmpdir(), `omniroute-build-isolated-${process.pid}-${Date.now()}`);

export function getTransientBuildPaths(rootDir = projectRoot, env = process.env) {
  const paths = [
    {
      label: "local Wine prefix",
      sourcePath: path.join(rootDir, ".tmp", "wine32"),
      backupPath: path.join(backupRoot, "wine32"),
    },
  ];

  if (env.OMNIROUTE_BUILD_MOVE_TASKS === "1") {
    paths.push({
      label: "task planning workspace",
      sourcePath: path.join(rootDir, "_tasks"),
      backupPath: path.join(backupRoot, "_tasks"),
    });
  }

  return paths;
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function movePath(sourcePath, destinationPath, fsImpl = fs) {
  const mkdir = typeof fsImpl.mkdir === "function" ? fsImpl.mkdir.bind(fsImpl) : fs.mkdir.bind(fs);
  await mkdir(path.dirname(destinationPath), { recursive: true });

  try {
    await fsImpl.rename(sourcePath, destinationPath);
  } catch (error) {
    if (error?.code !== "EXDEV") {
      throw error;
    }

    console.warn(
      `[build-next-isolated] EXDEV while moving ${sourcePath} -> ${destinationPath}; falling back to copy/remove`
    );
    await fsImpl.cp(sourcePath, destinationPath, {
      recursive: true,
      preserveTimestamps: true,
      force: false,
      errorOnExist: true,
    });
    await fsImpl.rm(sourcePath, { recursive: true, force: true });
  }
}

/**
 * Best-effort: physically create the isolated Windows profile dirs that
 * resolveNextBuildEnv() may have pointed APPDATA/LOCALAPPDATA at. No-op when
 * resolveNextBuildEnv didn't set them (non-Windows, or NEXT_DIST_DIR already set).
 */
export function ensureWindowsBuildProfileDirs(env, mkdirImpl = mkdirSync) {
  if (!env?.APPDATA || !env?.LOCALAPPDATA) return;
  mkdirImpl(env.APPDATA, { recursive: true });
  mkdirImpl(env.LOCALAPPDATA, { recursive: true });
}

function runNextBuild() {
  return new Promise((resolve) => {
    const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
    const webDir = path.join(projectRoot, "packages", "web");
    const buildCwd = fsExistsSync(webDir) ? webDir : projectRoot;
    const buildEnv = resolveNextBuildEnv(process.env);
    ensureWindowsBuildProfileDirs(buildEnv);
    const child = spawn(process.execPath, [nextBin, "build", resolveNextBuildBundlerFlag()], {
      cwd: buildCwd,
      stdio: "inherit",
      env: buildEnv,
    });

    const forward = (signal) => {
      if (!child.killed) child.kill(signal);
    };

    process.on("SIGINT", forward);
    process.on("SIGTERM", forward);

    child.on("exit", (code, signal) => {
      process.off("SIGINT", forward);
      process.off("SIGTERM", forward);
      if (signal) {
        resolve({ code: 1, signal });
        return;
      }
      resolve({ code: code ?? 1, signal: null });
    });
  });
}

/**
 * Next.js monorepo standalone nests server.js under packages/web/ when
 * outputFileTracingRoot is the repo root. Flatten so dist/server.js works
 * like OmniRoute (bin/cli/commands/serve.mjs expects it at the bundle root).
 */
export async function flattenMonorepoStandalone(standaloneDir, fsImpl = fs) {
  const nestedServer = path.join(standaloneDir, "packages", "web", "server.js");
  const rootServer = path.join(standaloneDir, "server.js");
  if (!(await exists(nestedServer)) || (await exists(rootServer))) return false;

  const nestedDir = path.join(standaloneDir, "packages", "web");
  const entries = await fsImpl.readdir(nestedDir);
  for (const entry of entries) {
    const src = path.join(nestedDir, entry);
    const dest = path.join(standaloneDir, entry);
    if (await exists(dest)) {
      // Prefer nested package contents for package.json / server.js collisions.
      await fsImpl.rm(dest, { recursive: true, force: true });
    }
    await movePath(src, dest, fsImpl);
  }
  // Drop empty packages/web shell if nothing remains under packages/
  try {
    await fsImpl.rm(path.join(standaloneDir, "packages", "web"), {
      recursive: true,
      force: true,
    });
  } catch {
    /* ignore */
  }
  console.log(
    "[build-next-isolated] Flattened monorepo standalone (packages/web → standalone root)"
  );
  return true;
}

export function resolveNextBuildBundlerFlag(baseEnv = process.env) {
  // Turbopack is the default production bundler (Next 16 stable). Benchmarked on
  // this codebase: 2-3x faster than the single-threaded webpack pass (17min -> 9min
  // on a 32-core box; ~20min -> 7min on ubuntu-latest), artifact validated
  // end-to-end (standalone smoke + e2e/package/electron CI jobs). Webpack stays as
  // the explicit escape hatch (=0) for bundler-compat regressions.
  return baseEnv.AIROUTE_USE_TURBOPACK === "0" || baseEnv.OMNIROUTE_USE_TURBOPACK === "0"
    ? "--webpack"
    : "--turbopack";
}

/**
 * Deterministic per-process isolated Windows user-profile directory, used to
 * sandbox HOME/USERPROFILE/APPDATA/LOCALAPPDATA for the spawned `next build`.
 * Kept as a separate helper (rather than inline in resolveNextBuildEnv) so the
 * directory-creation side effect (ensureWindowsBuildProfileDirs) can be invoked
 * once per real build without re-deriving the path.
 */
export function getWindowsBuildProfileDir() {
  return path.join(os.tmpdir(), `omniroute-build-winhome-${process.pid}`);
}

export function resolveNextBuildEnv(baseEnv = process.env, platform = process.platform) {
  const env = {
    ...baseEnv,
    NEXT_PRIVATE_BUILD_WORKER: baseEnv.NEXT_PRIVATE_BUILD_WORKER || "0",
  };

  // Windows-only: `next build`'s static-generation glob scan and framework cache
  // helpers walk %USERPROFILE%/AppData, which on GitHub-hosted Windows runners (and
  // some OneDrive-backed dev profiles) contains reparse points/junctions that raise
  // EPERM during Next's file-system scans. `.github/workflows/electron-release.yml`
  // ("Sanitize Windows home directory" step) already patches USERPROFILE for the CI
  // runner, but that only covers the electron-release CI job — a local `npm run
  // build` on Windows (or any other Windows CI path that calls this script
  // directly) hits the same EPERM unprotected. Doing the isolation here covers
  // every caller of build-next-isolated.mjs, not just one workflow step. Skipped
  // when a caller has already sandboxed the build via NEXT_DIST_DIR (the existing
  // signal this file already reads for "isolated build" callers — see `distDir`
  // above) to avoid double-isolating nested build invocations.
  // Port of decolua/9router#2402 ("fix(build): isolate Windows HOME/AppData
  // during next build").
  if (platform === "win32" && !baseEnv.NEXT_DIST_DIR) {
    const buildHomeDir = getWindowsBuildProfileDir();
    env.HOME = buildHomeDir;
    env.USERPROFILE = buildHomeDir;
    env.APPDATA = path.join(buildHomeDir, "AppData", "Roaming");
    env.LOCALAPPDATA = path.join(buildHomeDir, "AppData", "Local");
  }

  // Raise the Node heap for the spawned `next build`. The webpack production pass
  // ("Compiling instrumentation" bundles the whole server graph) is the heaviest
  // phase and overflows V8's default ~2 GB ceiling on memory-constrained machines,
  // stalling/OOMing local `npm run build` (npm-global installs). #4076/#4104 fixed
  // this only in the Docker builder stage (ENV NODE_OPTIONS); the local/native path
  // was left unprotected. Respect an existing --max-old-space-size (Docker already
  // sets one — don't clobber/duplicate) and let OMNIROUTE_BUILD_MEMORY_MB override.
  // NOTE (#6409): --max-old-space-size only bounds V8's JS heap — it does NOT bound
  // Turbopack's native (Rust, off-V8-heap) memory, which is the default bundler as of
  // #6283. On memory-constrained machines, set OMNIROUTE_USE_TURBOPACK=0 (webpack
  // fallback) instead of raising this heap value; see docs/reference/ENVIRONMENT.md.
  if (!/--max-old-space-size/.test(env.NODE_OPTIONS || "")) {
    // Default 8 GB (was 4 GB): the clean module graph peaks ~3.9 GB during the webpack
    // production pass, which brushed the old 4 GB ceiling on a borderline OOM. 8 GB gives
    // headroom without risk. NOTE: heap size does NOT fix a poisoned scope — if the build
    // OOMs/livelocks far above this, check for worktrees/cruft leaking into the tsconfig
    // scope (run `npm run check:build-scope`), not for "more heap". See incident 2026-06-25.
    const heapMb =
      Number(baseEnv.AIROUTE_BUILD_MEMORY_MB || baseEnv.OMNIROUTE_BUILD_MEMORY_MB) || 8192;
    env.NODE_OPTIONS = `${env.NODE_OPTIONS || ""} --max-old-space-size=${heapMb}`.trim();
  }

  return env;
}

async function resetStandaloneOutput(rootDir = projectRoot, fsImpl = fs) {
  // Clear both the Next project dist (packages/web/.build/next) and the mirrored
  // repo-root copy so a partial previous build cannot confuse assemble/Docker.
  const targets = [];
  if (rootDir === projectRoot) {
    targets.push(nextDistDir, distDir);
  } else {
    targets.push(
      path.join(rootDir, "packages", "web", webRelativeDistDir()),
      path.join(rootDir, process.env.NEXT_DIST_DIR || ".build/next")
    );
  }

  let i = 0;
  for (const resolvedDistDir of [...new Set(targets.map((p) => path.resolve(p)))]) {
    const standaloneRoot = path.join(resolvedDistDir, "standalone");
    if (!(await exists(standaloneRoot))) continue;
    const staleStandaloneBackup = path.join(backupRoot, `standalone-stale-${i++}`);
    await movePath(standaloneRoot, staleStandaloneBackup, fsImpl);
    console.log(
      `[build-next-isolated] Moved stale standalone out of ${path.relative(rootDir, standaloneRoot) || standaloneRoot}`
    );
  }
}

/**
 * Mirror packages/web/.build/next → repo-root .build/next so Dockerfile COPY
 * and prepublish keep using /app/.build/next/standalone.
 */
async function mirrorDistDirToRepoRoot(fsImpl = fs) {
  if (path.resolve(nextDistDir) === path.resolve(distDir)) return;
  if (!(await exists(nextDistDir))) return;

  await fsImpl.rm(distDir, { recursive: true, force: true });
  await fsImpl.mkdir(path.dirname(distDir), { recursive: true });
  await fsImpl.cp(nextDistDir, distDir, { recursive: true });
  console.log(
    `[build-next-isolated] Mirrored ${path.relative(projectRoot, nextDistDir)} → ${path.relative(projectRoot, distDir)}`
  );
}

export async function pruneStandaloneArtifacts(rootDir = projectRoot, fsImpl = fs) {
  const resolvedDistDirForPrune =
    rootDir === projectRoot
      ? nextDistDir
      : path.join(rootDir, "packages", "web", webRelativeDistDir());
  const standaloneRoot = path.join(resolvedDistDirForPrune, "standalone");
  const pruneTargets = [path.join(standaloneRoot, "_tasks")];

  for (const targetPath of pruneTargets) {
    if (!(await exists(targetPath))) continue;
    await fsImpl.rm(targetPath, { recursive: true, force: true });
    console.log(
      `[build-next-isolated] Pruned standalone artifact: ${path.relative(rootDir, targetPath)}`
    );
  }
}

export async function syncStandaloneNativeAssets(
  rootDir = projectRoot,
  fsImpl = fs,
  log = console
) {
  return _syncNativeAssets(rootDir, fsImpl, log);
}

export async function syncStandaloneExtraModules(
  rootDir = projectRoot,
  fsImpl = fs,
  log = console
) {
  return _syncExtraModules(rootDir, fsImpl, log);
}

export async function main() {
  const movedPaths = [];
  const transientBuildPaths = getTransientBuildPaths();

  // Backend-only fast build: replace the dashboard leaf pages with zero-cost stubs so
  // `next build` skips the frontend (client vendor chunks + prerender) while keeping every
  // API route handler. Restored in `finally` and on SIGINT/SIGTERM (git-recoverable regardless).
  let stubbedPages = [];
  const restoreStubbedPagesOnce = () => {
    if (stubbedPages.length > 0) {
      restoreDashboardPages(stubbedPages);
      stubbedPages = [];
    }
  };
  const onFatalSignal = (signal) => {
    console.warn(`[build-next-isolated] Received ${signal} — restoring stubbed pages before exit`);
    restoreStubbedPagesOnce();
    process.exit(1);
  };

  try {
    for (const entry of transientBuildPaths) {
      if (!(await exists(entry.sourcePath))) continue;
      await movePath(entry.sourcePath, entry.backupPath);
      movedPaths.push(entry);
    }

    if (isBackendOnlyBuild()) {
      console.log(
        "[build-next-isolated] OMNIROUTE_BUILD_BACKEND_ONLY set — building API only (dashboard UI stubbed)"
      );
      stubbedPages = stubDashboardPages(projectRoot);
      process.once("SIGINT", onFatalSignal);
      process.once("SIGTERM", onFatalSignal);
    }

    await resetStandaloneOutput(projectRoot);

    const result = await runNextBuild();
    const standaloneDir = path.join(nextDistDir, "standalone");
    if (result.code === 0 && !(await exists(standaloneDir))) {
      console.error(
        `[build-next-isolated] next build exited 0 but standalone output is missing at ${standaloneDir}`
      );
      process.exitCode = 1;
    } else if (result.code === 0 && (await exists(standaloneDir))) {
      try {
        await flattenMonorepoStandalone(standaloneDir);
      } catch (flattenErr) {
        console.warn(
          "[build-next-isolated] Non-fatal error flattening monorepo standalone:",
          flattenErr?.message
        );
      }

      try {
        await fs.cp(path.join(projectRoot, "docs"), path.join(standaloneDir, "docs"), {
          recursive: true,
        });
        console.log("[build-next-isolated] Copied docs/ to standalone output");
      } catch (docsCopyErr) {
        console.warn("[build-next-isolated] Non-fatal error copying docs/:", docsCopyErr?.message);
      }

      try {
        await pruneStandaloneArtifacts(projectRoot);
      } catch (pruneErr) {
        console.warn(
          "[build-next-isolated] Non-fatal error pruning standalone artifacts:",
          pruneErr
        );
      }

      // Best-effort: build the TPROXY native addon (Linux-only, opt-in) BEFORE
      // assembling, so its transparent.node is present for assembleStandalone's
      // NATIVE_ASSET_ENTRIES copy. Non-Linux / no-toolchain is non-fatal — the
      // capture mode degrades gracefully when the addon is absent.
      try {
        const { buildTproxyNative } = await import("./build-tproxy-native.mjs");
        const res = buildTproxyNative(projectRoot);
        console.log(
          res.built
            ? "[build-next-isolated] Built TPROXY native addon (transparent.node)"
            : `[build-next-isolated] TPROXY native addon skipped: ${res.reason}`
        );
      } catch (nativeErr) {
        console.warn(
          "[build-next-isolated] Non-fatal error building TPROXY native addon:",
          nativeErr?.message
        );
      }

      try {
        console.log(
          "[build-next-isolated] Assembling standalone bundle (static + public + natives + extras)..."
        );
        assembleStandalone({
          distDir: nextDistDir,
          outDir: standaloneDir,
          projectRoot,
          // Next bakes `./.build/next` relative to packages/web; natives still
          // resolve from the repo-root node_modules via projectRoot.
          relDistDir: webRelativeDistDir(),
          copyNatives: true,
        });
        const { spawnSync } = await import("node:child_process");
        const basePathWrite = spawnSync(
          process.execPath,
          [path.join(projectRoot, "scripts", "build", "write-build-base-path.mjs")],
          {
            cwd: projectRoot,
            // write-build-base-path reads NEXT_DIST_DIR relative to repo root; point
            // it at the web dist until we mirror (or at the mirror path after).
            env: {
              ...process.env,
              NEXT_DIST_DIR: path.relative(projectRoot, nextDistDir),
            },
            stdio: "inherit",
          }
        );
        if (basePathWrite.status !== 0) {
          console.warn(
            "[build-next-isolated] Non-fatal error writing BUILD_OMNIROUTE_BASE_PATH sentinel"
          );
        }
      } catch (assembleErr) {
        console.warn("[build-next-isolated] Non-fatal error assembling standalone:", assembleErr);
      }

      try {
        await mirrorDistDirToRepoRoot();
      } catch (mirrorErr) {
        console.error(
          "[build-next-isolated] Failed to mirror distDir to repo root:",
          mirrorErr?.message || mirrorErr
        );
        process.exitCode = 1;
      }
    }
    if (process.exitCode == null) process.exitCode = result.code;
  } catch (error) {
    console.error("[build-next-isolated] Build failed:", error);
    process.exitCode = 1;
  } finally {
    // Restore the stubbed dashboard pages FIRST so the working tree is clean even if the
    // transient-path restore below throws.
    restoreStubbedPagesOnce();
    process.off("SIGINT", onFatalSignal);
    process.off("SIGTERM", onFatalSignal);

    while (movedPaths.length > 0) {
      const entry = movedPaths.pop();
      if (!entry) continue;
      try {
        await movePath(entry.backupPath, entry.sourcePath);
      } catch (restoreError) {
        console.error(
          `[build-next-isolated] Failed to restore ${entry.label} from ${entry.backupPath}:`,
          restoreError
        );
        process.exitCode = 1;
      }
    }

    try {
      await fs.rm(backupRoot, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn("[build-next-isolated] Failed to clean temporary backup root:", cleanupError);
    }
  }
}

const entryScript = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (entryScript === import.meta.url) {
  await main();
}
