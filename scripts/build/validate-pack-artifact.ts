#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  PACK_ARTIFACT_ALLOWED_EXACT_PATHS,
  PACK_ARTIFACT_ALLOWED_PATH_PREFIXES,
  PACK_ARTIFACT_REQUIRED_PATHS,
  findMissingArtifactPaths,
  findUnexpectedArtifactPaths,
} from "./pack-artifact-policy.ts";

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = dirname(__filename);
const ROOT: string = join(__dirname, "..", "..");
const npmCommand: string = process.platform === "win32" ? "npm.cmd" : "npm";

function runNpm(args: string[], stdio: "inherit" | "pipe" = "pipe"): string {
  const npmExecPath = process.env.npm_execpath;
  const isBunRuntime = "Bun" in globalThis;
  const command = npmExecPath && !isBunRuntime ? process.execPath : npmCommand;
  const commandArgs = npmExecPath && !isBunRuntime ? [npmExecPath, ...args] : args;

  return execFileSync(command, commandArgs, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: stdio === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      // Keep stdout = JSON only. Notice lines can include paths like
      // `api/[...model]/` which break naive `[` … `]` slicing.
      npm_config_loglevel: "silent",
      NPM_CONFIG_LOGLEVEL: "silent",
      npm_config_fund: "false",
      npm_config_audit: "false",
    },
  });
}

/** Drop npm CLI chatter that may precede/follow `--json` payloads. */
export function stripNpmCliNoise(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*npm\s+(notice|warn|error|info|http|timing|silly)\b/i.test(line))
    .join("\n")
    .trim();
}

/** Parse one complete JSON value starting at `start` (string-aware). */
export function parseJsonValueAt(text: string, start: number): unknown {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      depth++;
      continue;
    }
    if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        return JSON.parse(text.slice(start, i + 1));
      }
    }
  }

  throw new Error("npm pack --json output was truncated or malformed.");
}

export type NpmPackReport = {
  filename?: string;
  entryCount?: number;
  size?: number;
  unpackedSize?: number;
  files: Array<{ path: string; size?: number; mode?: number }>;
};

/**
 * Normalize npm pack --json shapes:
 * - npm ≤11: `[{ name, files, filename, ... }]`
 * - npm ≥12: `{ "<pkg>": { name, files, filename, ... } }`
 */
export function extractPackReport(parsed: unknown): NpmPackReport | null {
  if (!parsed || typeof parsed !== "object") return null;

  if (Array.isArray(parsed)) {
    const first = parsed[0];
    if (first && typeof first === "object" && Array.isArray((first as NpmPackReport).files)) {
      return first as NpmPackReport;
    }
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.files)) {
    return record as NpmPackReport;
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object" && Array.isArray((value as NpmPackReport).files)) {
      return value as NpmPackReport;
    }
  }

  return null;
}

/**
 * Locate the `npm pack --json` report.
 * Prefers a top-level array/object that has a `files` array (the pack report),
 * skipping incidental `[` characters inside earlier notice text.
 */
export function parseNpmPackReport(output: string): NpmPackReport {
  const text = stripNpmCliNoise(output);
  if (!text) {
    throw new Error("npm pack --dry-run --json produced empty output.");
  }

  // Candidate starts: beginning of payload, or a `[`/`{` that begins a line
  // (after optional indent). Skips brackets inside paths like `/[...model]/`.
  const starts: number[] = [];
  if (text[0] === "[" || text[0] === "{") {
    starts.push(0);
  }
  for (const match of text.matchAll(/(?:\r?\n)([ \t]*)([\[{])/g)) {
    const indent = match[1] ?? "";
    const abs = (match.index ?? 0) + match[0].length - 1;
    // Only treat as a new top-level value when the bracket opens the line
    // (indent only). Nested structures are discovered via parseJsonValueAt.
    if (indent.length <= 2) {
      starts.push(abs);
    }
  }

  const seen = new Set<number>();
  const errors: string[] = [];

  for (const start of starts) {
    if (seen.has(start)) continue;
    seen.add(start);
    try {
      const parsed = parseJsonValueAt(text, start);
      const report = extractPackReport(parsed);
      if (report) return report;
    } catch (err: any) {
      errors.push(String(err?.message || err));
    }
  }

  throw new Error(
    "npm pack --dry-run --json did not return the expected files[] payload." +
      (errors.length ? ` Last parse error: ${errors[errors.length - 1]}` : "")
  );
}

function ensureAppStagingReady(): void {
  const missingAppRequiredPaths = PACK_ARTIFACT_REQUIRED_PATHS.filter((requiredPath) =>
    requiredPath.startsWith("dist/")
  ).filter((requiredPath) => !existsSync(join(ROOT, requiredPath)));

  if (missingAppRequiredPaths.length === 0) return;

  console.log("📦 dist/ staging is missing required runtime files; running npm run build:cli...");
  runNpm(["run", "build:cli"], "inherit");
}

function runPackDryRun(): ReturnType<typeof parseNpmPackReport> {
  const output = runNpm(["pack", "--dry-run", "--json", "--ignore-scripts"]);
  return parseNpmPackReport(output);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) {
    return `${bytes || 0} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

const POLICY_ONLY = process.argv.includes("--policy-only");

function main(): void {
  try {
    if (!POLICY_ONLY) ensureAppStagingReady();
    const packReport = runPackDryRun();
    const artifactPaths: string[] = packReport.files.map((file) => file.path);
    const unexpectedPaths: string[] = findUnexpectedArtifactPaths(artifactPaths, {
      exactPaths: PACK_ARTIFACT_ALLOWED_EXACT_PATHS,
      prefixPaths: PACK_ARTIFACT_ALLOWED_PATH_PREFIXES,
    });
    const missingRequiredPaths: string[] = POLICY_ONLY
      ? []
      : findMissingArtifactPaths(artifactPaths, PACK_ARTIFACT_REQUIRED_PATHS);

    console.log("📦 npm pack artifact summary");
    console.log(`   File:          ${packReport.filename}`);
    console.log(`   Entry count:   ${packReport.entryCount}`);
    console.log(`   Packed size:   ${formatBytes(packReport.size || 0)}`);
    console.log(`   Unpacked size: ${formatBytes(packReport.unpackedSize || 0)}`);

    if (unexpectedPaths.length > 0) {
      console.error("\n❌ Unexpected files were found in the npm publish artifact:");
      for (const unexpectedPath of unexpectedPaths) {
        console.error(`   - ${unexpectedPath}`);
      }
    }

    if (missingRequiredPaths.length > 0) {
      console.error("\n❌ Required runtime files are missing from the npm publish artifact:");
      for (const missingPath of missingRequiredPaths) {
        console.error(`   - ${missingPath}`);
      }
    }

    if (unexpectedPaths.length > 0 || missingRequiredPaths.length > 0) {
      process.exit(1);
    }

    console.log("\n✅ Pack artifact policy check passed.");
  } catch (error: any) {
    console.error(`\n❌ Pack artifact validation failed: ${error.message}`);
    process.exit(1);
  }
}

// Only run when executed directly — importing for unit tests must not trigger builds.
function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main();
}
