import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import createNextIntlPlugin from "next-intl/plugin";
import { createMDX } from "fumadocs-mdx/next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const coreDir = path.resolve(__dirname, "../core");
const openSseDir = path.resolve(__dirname, "../open-sse");
const webAppDir = path.resolve(__dirname, "src/app");

// Load monorepo-root `.env` into this process. Next only auto-loads env files
// from the package cwd (`packages/web`); without this, JWT_SECRET is missing
// in route handlers until instrumentation restores a persisted fallback.
const loaded = nextEnv.loadEnvConfig(repoRoot);
for (const [key, value] of Object.entries(loaded.combinedEnv ?? {})) {
  if (value == null || value === "") continue;
  if (!process.env[key] || process.env[key].trim() === "") {
    process.env[key] = value;
  }
}

// next-intl request config lives in @airoute/core (no src/i18n symlink).
const withNextIntl = createNextIntlPlugin("../core/i18n/request.ts");
// Emit fumadocs generated modules to the monorepo-root `.source/` directory.
const withMDX = createMDX({
  outDir: path.resolve(repoRoot, ".source"),
});

// Next.js requires distDir to stay *inside* the project directory (packages/web).
// Absolute paths like `/app/.build/next` are broken by `path.join(projectDir, distDir)`
// on POSIX → `packages/web/app/.build/next` (and `/home/...` → `packages/web/home/...`).
// `../.build/next` is also invalid per Next docs. Keep a project-local relative dir;
// build-next-isolated mirrors it to the repo-root `.build/next` for Docker/prepublish.
function resolveWebDistDir() {
  const raw = process.env.NEXT_DIST_DIR;
  if (raw && !path.isAbsolute(raw) && !raw.split(/[\\/]/).includes("..")) {
    return raw;
  }
  return ".build/next";
}
const distDir = resolveWebDistDir();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  distDir,
  compress: true,
  productionBrowserSourceMaps: false,
  // Pre-existing TS debt is gated by `typecheck:core` / `check:dashboard-typecheck`,
  // not `next build` (same as OmniRoute). Without this, Docker fails one error at a time.
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    "@omniroute/open-sse",
    "@airoute/core",
    "fumadocs-ui",
    "fumadocs-core",
  ],
  experimental: {
    externalDir: true,
    serverActions: {
      bodySizeLimit: process.env.OMNIROUTE_SERVER_ACTIONS_BODY_LIMIT || "50mb",
    },
    proxyClientMaxBodySize: process.env.NEXT_PROXY_BODY_LIMIT || "512mb",
    optimizePackageImports: [
      "@lobehub/icons",
      "lucide-react",
      "material-symbols",
      "next-intl",
    ],
  },
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/*": [
      "../core/lib/db/migrations/**/*",
      "../core/mitm/server.cjs",
      "../open-sse/services/compression/engines/rtk/filters/**/*.json",
      "../open-sse/services/compression/rules/**/*.json",
      "../open-sse/lib/sha3_wasm_bg.wasm",
      "../open-sse/lib/deepseek-pow-solver.cjs",
      "../../node_modules/sql.js/dist/sql-wasm.wasm",
    ],
  },
  outputFileTracingExcludes: {
    "/*": [
      "../../.git/**/*",
      "../../coverage/**/*",
      "../../test-results/**/*",
      "../../playwright-report/**/*",
      "../../tests/**/*",
      "../../logs/**/*",
    ],
  },
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "thread-stream",
    "pino-abstract-transport",
    "better-sqlite3",
    "sql.js",
    "sqlite-vec",
    "node-machine-id",
    "keytar",
    "wreq-js",
    "tls-client-node",
    "koffi",
    "ws",
    "bufferutil",
    "utf-8-validate",
    "@ngrok/ngrok",
    "@huggingface/transformers",
  ],
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      "@/app": webAppDir,
      "@": coreDir,
      "@omniroute/open-sse": openSseDir,
      "@airoute/core": coreDir,
      "@airoute/open-sse": openSseDir,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@/app": webAppDir,
      "@": coreDir,
      "@omniroute/open-sse": openSseDir,
      "@airoute/core": coreDir,
      "@airoute/open-sse": openSseDir,
    };
    return config;
  },
  async rewrites() {
    return [
      { source: "/chat/completions", destination: "/api/v1/chat/completions" },
      { source: "/responses", destination: "/api/v1/responses" },
      { source: "/responses/:path*", destination: "/api/v1/responses/:path*" },
      { source: "/models", destination: "/api/v1/models" },
      { source: "/v1/v1/:path*", destination: "/api/v1/:path*" },
      { source: "/v1/v1", destination: "/api/v1" },
      { source: "/codex/:path*", destination: "/api/v1/responses" },
      { source: "/v1/:path*", destination: "/api/v1/:path*" },
      { source: "/v1", destination: "/api/v1" },
      { source: "/v1beta/:path*", destination: "/api/v1beta/:path*" },
      { source: "/v1beta", destination: "/api/v1beta" },
    ];
  },
};

export default withMDX(withNextIntl(nextConfig));
