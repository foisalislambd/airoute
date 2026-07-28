import type { NextRequest } from "next/server";
import { runAuthzPipeline } from "./server/authz/pipeline";

export async function proxy(request: NextRequest) {
  return runAuthzPipeline(request, { enforce: true });
}

/** Matcher lives in packages/web/src/proxy.ts (Next requires a local literal). */
export const PROXY_MATCHER = [
  "/",
  "/dashboard/:path*",
  "/home",
  "/home/:path*",
  "/api/:path*",
  "/v1/:path*",
  "/v1",
  "/v1beta/:path*",
  "/v1beta",
  "/chat/:path*",
  "/responses/:path*",
  "/responses",
  "/codex/:path*",
  "/codex",
  "/models",
] as const;

