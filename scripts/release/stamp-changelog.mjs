#!/usr/bin/env node
/**
 * Insert a version section under ## [Unreleased] in CHANGELOG.md
 * Usage: node scripts/release/stamp-changelog.mjs 1.0.0
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  console.error("Usage: stamp-changelog.mjs X.Y.Z");
  process.exit(1);
}

const path = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "CHANGELOG.md");
if (!existsSync(path)) {
  console.log("No CHANGELOG.md — skip");
  process.exit(0);
}

const date = new Date().toISOString().slice(0, 10);
let text = readFileSync(path, "utf8");
if (text.includes(`## [${version}]`)) {
  console.log(`CHANGELOG already has [${version}] — skip`);
  process.exit(0);
}

if (!text.includes("## [Unreleased]")) {
  text = `# Changelog\n\n## [Unreleased]\n\n## [${version}] — ${date}\n\n` + text;
} else {
  text = text.replace(
    "## [Unreleased]\n",
    `## [Unreleased]\n\n## [${version}] — ${date}\n`
  );
}

writeFileSync(path, text);
console.log(`CHANGELOG: added [${version}] — ${date}`);
