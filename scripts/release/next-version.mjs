#!/usr/bin/env node
/**
 * AIRoute version scheme (digit roll-over at 9):
 *
 *   1.0.0 → 1.0.1 → … → 1.0.9 → 1.1.0 → … → 1.9.9 → 2.0.0 → …
 *
 * First public line starts at 1.0.0. Any 0.x.y bootstraps to 1.0.0.
 *
 * Usage:
 *   node scripts/release/next-version.mjs next 1.0.9          → 1.1.0
 *   node scripts/release/next-version.mjs resolve 0.1.0 ""    → 1.0.0
 *   node scripts/release/next-version.mjs resolve 1.0.0 v1.0.0 → 1.0.1
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {string} current
 * @returns {string}
 */
export function nextVersion(current) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(current || "").trim());
  if (!match) {
    throw new Error(`Invalid semver (expected X.Y.Z): ${current}`);
  }

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  if (major < 1) {
    return "1.0.0";
  }

  if (patch < 9) {
    patch += 1;
  } else if (minor < 9) {
    minor += 1;
    patch = 0;
  } else {
    major += 1;
    minor = 0;
    patch = 0;
  }

  return `${major}.${minor}.${patch}`;
}

/**
 * @param {string} current
 * @param {string[]} tags
 */
export function resolveReleaseVersion(current, tags = []) {
  const hasReleaseTag = (tags || []).some((t) => /^v\d+\.\d+\.\d+$/.test(String(t)));
  if (!hasReleaseTag) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(current || "").trim());
    if (!match || Number(match[1]) < 1) return "1.0.0";
    return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
  }
  return nextVersion(current);
}

function main() {
  const mode = process.argv[2] || "next";
  const current = process.argv[3] || process.env.CURRENT_VERSION;
  if (!current) {
    console.error("Usage: next-version.mjs <next|resolve> <current> [tag1,tag2,...]");
    process.exit(1);
  }
  if (mode === "resolve") {
    const tags = (process.argv[4] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    process.stdout.write(resolveReleaseVersion(current, tags));
    return;
  }
  process.stdout.write(nextVersion(current));
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || "")) {
  main();
}
