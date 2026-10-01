import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = path.join(root, "packages", "cli");
const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
const pkgPath = path.join(pkgDir, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const panel = spawnSync(npm, ["run", "build:panel"], { cwd: root, stdio: "inherit" });
if (panel.status !== 0) process.exit(panel.status ?? 1);

const targets = [
  ["windows", "amd64", "win32-x64", "airoute.exe"],
  ["linux", "amd64", "linux-x64", "airoute"],
  ["darwin", "amd64", "darwin-x64", "airoute"],
  ["darwin", "arm64", "darwin-arm64", "airoute"],
];

const vendor = path.join(pkgDir, "vendor");
rmSync(vendor, { recursive: true, force: true });
for (const [goos, goarch, folder, name] of targets) {
  const dir = path.join(vendor, folder);
  mkdirSync(dir, { recursive: true });
  const out = path.join(dir, name);
  const build = spawnSync("go", ["build", "-trimpath", "-ldflags", "-s -w", "-o", out, "./apps/server/cmd/airoute"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, CGO_ENABLED: "0", GOOS: goos, GOARCH: goarch },
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
  console.log(`built ${path.relative(root, out)}`);
}

const panelOut = path.join(pkgDir, "panel");
rmSync(panelOut, { recursive: true, force: true });
cpSync(path.join(root, "apps", "panel", "dist"), panelOut, { recursive: true });
console.log(`airoute npm package ${version} is in packages/cli`);
