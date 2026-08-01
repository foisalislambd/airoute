#!/usr/bin/env node
/**
 * Write the same version into root + workspace package.json files
 * and the root package-lock.json version fields.
 * Usage: node scripts/release/bump-version.mjs 1.0.1
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TARGETS = [
  "package.json",
  "packages/web/package.json",
  "packages/core/package.json",
  "packages/open-sse/package.json",
];

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  console.error("Usage: bump-version.mjs X.Y.Z");
  process.exit(1);
}

for (const rel of TARGETS) {
  const path = join(ROOT, rel);
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  pkg.version = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`  ${rel} → ${version}`);
}

const lockPath = join(ROOT, "package-lock.json");
if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.version = version;
  if (lock.packages && lock.packages[""]) {
    lock.packages[""].version = version;
  }
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`  package-lock.json → ${version}`);
}
