/**
 * Shared policy for AIRoute npm publish artifact hygiene.
 *
 * The package publishes the standalone runtime under dist/ (Layer 1: renamed from app/).
 * This policy keeps local backups, QA scratch files, and development-only
 * dirs out of the staged dist/ tree and out of the final tarball.
 */

const STAGING_FORBIDDEN_DIRECTORIES = [
  "app.__qa_backup",
  "coverage",
  "electron",
  "logs",
  "scripts/scratch",
  "tests",
  "vscode-extension",
  "_ideia",
  "_mono_repo",
  "_references",
  "_tasks",
];

const STAGING_FORBIDDEN_FILES = ["audit-report.json", "package-lock.json"];

export const APP_STAGING_REMOVAL_PATHS: string[] = [
  ...STAGING_FORBIDDEN_DIRECTORIES,
  ...STAGING_FORBIDDEN_FILES,
  // onnxruntime CUDA provider binary (~316 MB) inflates the npm tarball
  // past the registry 413 limit for npm.org.  It's only needed on systems
  // with a CUDA GPU — users install CUDA providers separately.
  "node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime_providers_cuda.so",
];

export const APP_STAGING_ALLOWED_EXACT_PATHS: string[] = [
  ".env.example",
  "BUILD_SHA",
  "docs/openapi.yaml",
  "head-response-guard.cjs",
  "http-method-guard.cjs",
  "open-sse/mcp-server/server.js",
  "open-sse/services/compression/engines/llmlingua/onnxWorker.js",
  "package.json",
  "peer-stamp.mjs",
  "main-server-timeouts.mjs",
  "responses-ws-proxy.mjs",
  "scripts/dev/sync-env.mjs",
  "scripts/dev/tls-options.mjs",
  "server.js",
  "server-ws.mjs",
  "tls-options.mjs",
  "webdav-handler.mjs",
];

export const APP_STAGING_ALLOWED_PATH_PREFIXES: string[] = [
  // Layer 1: Next.js distDir changed from ".next" to ".build/next"; the server
  // bundle now lives under .build/next/ inside the standalone output.
  ".build/next/",
  ".next/",
  "data/",
  "node_modules/",
  "open-sse/services/compression/engines/rtk/filters/",
  "open-sse/services/compression/rules/",
  "public/",
  "src/lib/db/migrations/",
  "src/mitm/",
];

export const PACK_ARTIFACT_ALLOWED_EXACT_PATHS: string[] = APP_STAGING_ALLOWED_EXACT_PATHS.map(
  (filePath: string) => `dist/${filePath}`
);

export const PACK_ARTIFACT_ALLOWED_PATH_PREFIXES: string[] = APP_STAGING_ALLOWED_PATH_PREFIXES.map(
  (directoryPath: string) => `dist/${directoryPath}`
);

export const PACK_ARTIFACT_ROOT_ALLOWED_EXACT_PATHS: string[] = [
  ".env.example",
  "LICENSE",
  "README.md",
  "bin/aliasResolver.mjs",
  "bin/aliasResolverHook.mjs",
  "bin/mcp-server.mjs",
  "bin/nodeRuntimeSupport.mjs",
  "bin/airoute.mjs",
  "bin/omniroute.mjs",
  "bin/reset-password.mjs",
  "bin/_ops-common.sh",
  "bin/cold-start-bench.sh",
  "bin/restore-data.sh",
  "bin/restore-policies.sh",
  "bin/rollback.sh",
  "bin/snapshot-data.sh",
  "packages/open-sse/mcp-server/README.md",
  "packages/open-sse/mcp-server/audit.ts",
  "packages/open-sse/mcp-server/httpTransport.ts",
  "packages/open-sse/mcp-server/index.ts",
  "packages/open-sse/mcp-server/runtimeHeartbeat.ts",
  "packages/open-sse/mcp-server/scopeEnforcement.ts",
  "packages/open-sse/mcp-server/server.ts",
  "packages/open-sse/utils/setupPolyfill.ts",
  "package.json",
  "scripts/build/build-next-isolated.mjs",
  "scripts/check/check-supported-node-runtime.ts",
  "scripts/build/native-binary-compat.mjs",
  "scripts/build/postinstall.mjs",
  "scripts/build/postinstallSupport.mjs",
  "scripts/build/colocateOptionals.mjs",
  "scripts/build/fixTlsClientNodeBinary.mjs",
  "scripts/build/runtime-env.mjs",
  "scripts/build/sync-env.mjs",
  "scripts/dev/responses-ws-proxy.mjs",
  "scripts/dev/sync-env.mjs",
  "scripts/dev/tls-options.mjs",
  "scripts/postinstall.mjs",
  "packages/core/shared/utils/nodeRuntimeSupport.ts",
];

export const PACK_ARTIFACT_ROOT_ALLOWED_PATH_PREFIXES: string[] = [
  "@omniroute/opencode-plugin/",
  "@omniroute/opencode-provider/",
  "bin/cli/",
  // Monorepo source shipped for tsx CLI / MCP runtime imports.
  "packages/open-sse/",
  "packages/core/",
];

export const PACK_ARTIFACT_REQUIRED_PATHS: string[] = [
  "dist/open-sse/services/compression/engines/rtk/filters/generic-output.json",
  "dist/open-sse/services/compression/rules/en/filler.json",
  "dist/server.js",
  "dist/server-ws.mjs",
  "dist/responses-ws-proxy.mjs",
  "dist/peer-stamp.mjs",
  "dist/main-server-timeouts.mjs",
  "dist/http-method-guard.cjs",
  "dist/tls-options.mjs",
  "dist/head-response-guard.cjs",
  "dist/webdav-handler.mjs",
  "bin/cli/program.mjs",
  "bin/cli/data-dir.mjs",
  "bin/cli/utils/ensureAndroidCacheDir.mjs",
  "bin/cli/utils/storageKeyProvision.mjs",
  "bin/cli/utils/versionFastPath.mjs",
  "bin/mcp-server.mjs",
  "bin/nodeRuntimeSupport.mjs",
  "bin/omniroute.mjs",
  "bin/airoute.mjs",
  "bin/aliasResolver.mjs",
  "bin/aliasResolverHook.mjs",
  "package.json",
  "scripts/build/native-binary-compat.mjs",
  "scripts/build/postinstall.mjs",
  "scripts/build/postinstallSupport.mjs",
  "scripts/build/colocateOptionals.mjs",
  "scripts/build/fixTlsClientNodeBinary.mjs",
  "scripts/build/runtime-env.mjs",
  "packages/core/shared/utils/nodeRuntimeSupport.ts",
];

PACK_ARTIFACT_ALLOWED_EXACT_PATHS.push(...PACK_ARTIFACT_ROOT_ALLOWED_EXACT_PATHS);
PACK_ARTIFACT_ALLOWED_PATH_PREFIXES.push(...PACK_ARTIFACT_ROOT_ALLOWED_PATH_PREFIXES);

export function normalizeArtifactPath(filePath: string): string {
  return String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
}

export function findUnexpectedArtifactPaths(
  filePaths: string[],
  { exactPaths = [], prefixPaths = [] }: { exactPaths?: string[]; prefixPaths?: string[] } = {}
): string[] {
  const normalizedExact = new Set(exactPaths.map(normalizeArtifactPath));
  const normalizedPrefixes = prefixPaths.map(normalizeArtifactPath);

  return filePaths
    .map(normalizeArtifactPath)
    .filter(Boolean)
    .filter(
      (filePath) =>
        !normalizedExact.has(filePath) &&
        !normalizedPrefixes.some((prefix) => filePath.startsWith(prefix))
    )
    .sort();
}

export function findMissingArtifactPaths(
  filePaths: string[],
  requiredPaths: string[] = []
): string[] {
  const normalizedPaths = new Set(filePaths.map(normalizeArtifactPath).filter(Boolean));
  return requiredPaths
    .map(normalizeArtifactPath)
    .filter(Boolean)
    .filter((requiredPath) => !normalizedPaths.has(requiredPath))
    .sort();
}
