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

// Load root `.env` (no packages/web/.env symlink). Next also loads local env files.
nextEnv.loadEnvConfig(repoRoot);

// next-intl request config lives in @airoute/core (no src/i18n symlink).
const withNextIntl = createNextIntlPlugin("../core/i18n/request.ts");
// Emit fumadocs generated modules to the monorepo-root `.source/` directory.
const withMDX = createMDX({
  outDir: path.resolve(repoRoot, ".source"),
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@omniroute/open-sse",
    "@airoute/core",
    "fumadocs-ui",
    "fumadocs-core",
  ],
  experimental: {
    externalDir: true,
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
