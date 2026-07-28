/**
 * Next.js proxy/middleware entry (must live under packages/web/src).
 * Authz implementation lives in @airoute/core — but `config` must be a
 * local literal export so Next can statically analyze the matcher.
 */
export { proxy } from "../../core/proxy.ts";

export const config = {
  matcher: [
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
  ],
};
