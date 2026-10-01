import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "packages", "cli");
const owner = process.env.GITHUB_REPOSITORY_OWNER || "";
const repo = process.env.GITHUB_REPOSITORY || "";
const token = process.env.GITHUB_TOKEN || "";

if (!owner || !repo || !token) {
  console.error("Publish runs in GitHub Actions, where the repository and GITHUB_TOKEN are set.");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(path.join(cli, "package.json"), "utf8"));
const version = pkg.version;
if (pkg.name !== "airoute") {
  console.error(`packages/cli must publish as airoute, got ${pkg.name}`);
  process.exit(1);
}
if (!existsSync(path.join(cli, "panel", "index.html"))) {
  console.error("The web panel was not built into packages/cli/panel.");
  process.exit(1);
}
for (const folder of ["win32-x64", "linux-x64", "darwin-x64", "darwin-arm64"]) {
  const dir = path.join(cli, "vendor", folder);
  if (!existsSync(dir)) {
    console.error(`Missing packaged program for ${folder}.`);
    process.exit(1);
  }
}

function run(args, cwd, env) {
  return spawnSync("npm", args, { cwd, env, encoding: "utf8" });
}

function runInherit(args, cwd, env) {
  const result = spawnSync("npm", args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function npmToken() {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL || "";
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || "";
  if (!requestUrl || !requestToken) {
    console.error("GitHub did not provide an OIDC token. The release job needs id-token: write.");
    process.exit(1);
  }
  const url = new URL(requestUrl);
  url.searchParams.set("audience", "npm:registry.npmjs.org");
  const idResponse = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${requestToken}` },
  });
  const idBody = await idResponse.json().catch(() => ({}));
  if (!idResponse.ok || !idBody.value) {
    console.error(`GitHub refused the OIDC token (${idResponse.status}).`);
    process.exit(1);
  }
  const exchange = await fetch("https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/airoute", {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${idBody.value}` },
  });
  const text = await exchange.text();
  if (!exchange.ok) {
    console.error(`npm trusted publisher rejected the release (${exchange.status}).`);
    console.error(text.slice(0, 500));
    console.error("On https://www.npmjs.com/package/airoute/access add Trusted Publisher: user foisalislambd, repository airoute, workflow filename release.yml, environment blank, allowed action npm publish.");
    process.exit(1);
  }
  const payload = JSON.parse(text);
  if (!payload.token) {
    console.error("npm trusted publisher did not return a publish token.");
    process.exit(1);
  }
  return payload.token;
}

function fail(result) {
  process.stderr.write(result.stderr || result.stdout || "npm failed\n");
  process.exit(result.status ?? 1);
}

const publicEnv = { ...process.env };
delete publicEnv.NODE_AUTH_TOKEN;
delete publicEnv.NPM_TOKEN;

function missing(spec, registry, env) {
  const args = ["view", spec, "version", "--json"];
  if (registry) args.push("--registry", registry);
  const result = run(args, root, env);
  if (result.status === 0) return false;
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (text.includes("E404") || text.includes("404")) return true;
  fail(result);
}

if (missing(`airoute@${version}`, "https://registry.npmjs.org", publicEnv)) {
  const tokenFile = path.join(tmpdir(), `airoute-npm-${process.pid}.npmrc`);
  const publishToken = await npmToken();
  writeFileSync(tokenFile, `//registry.npmjs.org/:_authToken=${publishToken}\n`);
  try {
    runInherit(["publish", "--access", "public"], cli, {
      ...publicEnv,
      NPM_CONFIG_USERCONFIG: tokenFile,
    });
  } finally {
    rmSync(tokenFile, { force: true });
  }
  console.log(`published airoute@${version} to npm`);
} else {
  console.log(`airoute@${version} is already on npm`);
}

const stage = mkdtempSync(path.join(tmpdir(), "airoute-gh-"));
try {
  cpSync(cli, stage, {
    recursive: true,
    filter: (src) => path.basename(src) !== "node_modules",
  });
  const stagedPath = path.join(stage, "package.json");
  const staged = JSON.parse(readFileSync(stagedPath, "utf8"));
  staged.name = `@${owner}/airoute`;
  staged.repository = {
    type: "git",
    url: `git+https://github.com/${repo}.git`,
  };
  staged.publishConfig = {
    registry: "https://npm.pkg.github.com",
    access: "public",
  };
  writeFileSync(stagedPath, `${JSON.stringify(staged, null, 2)}\n`);
  writeFileSync(
    path.join(stage, ".npmrc"),
    `@${owner}:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}\n`,
  );
  const ghEnv = {
    ...process.env,
    NODE_AUTH_TOKEN: token,
    NPM_CONFIG_USERCONFIG: path.join(stage, ".npmrc"),
  };
  const spec = `@${owner}/airoute@${version}`;
  if (missing(spec, "https://npm.pkg.github.com", ghEnv)) {
    runInherit(["publish", "--access", "public"], stage, ghEnv);
    console.log(`published ${spec} to GitHub Packages`);
  } else {
    console.log(`${spec} is already on GitHub Packages`);
  }
} finally {
  rmSync(stage, { recursive: true, force: true });
}
