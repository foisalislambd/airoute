/**
 * MCP Authorization Scopes — Defines permission scopes for each MCP tool.
 *
 * Each tool requires specific scopes to execute. API keys can be configured
 * with a subset of scopes to limit tool access (least-privilege).
 */

// ============ Scope Definitions ============

/** All available MCP scopes */
export const MCP_SCOPE_LIST = [
  "read:health",
  "read:combos",
  "write:combos",
  "read:quota",
  "read:usage",
  "read:models",
  "execute:completions",
  "execute:search",
  "write:budget",
  "write:resilience",
  "pricing:write",
  "read:cache",
  "write:cache",
  "read:compression",
  "write:compression",
  "read:proxies",
] as const;

export type McpScope = (typeof MCP_SCOPE_LIST)[number];

// ============ Tool → Scope Mapping ============

/** Maps each MCP tool to its required scopes */
export const MCP_TOOL_SCOPES: Record<string, readonly McpScope[]> = {
  // Phase 1: Essential Tools
  airoute_get_health: ["read:health"],
  airoute_list_combos: ["read:combos"],
  airoute_get_combo_metrics: ["read:combos"],
  airoute_switch_combo: ["write:combos"],
  airoute_check_quota: ["read:quota"],
  airoute_route_request: ["execute:completions"],
  airoute_web_search: ["execute:search"],
  airoute_web_fetch: ["execute:search"],
  airoute_cost_report: ["read:usage"],
  airoute_list_models_catalog: ["read:models"],

  // Phase 2: Advanced Tools
  airoute_simulate_route: ["read:health", "read:combos"],
  airoute_set_budget_guard: ["write:budget"],
  airoute_set_resilience_profile: ["write:resilience"],
  airoute_test_combo: ["execute:completions", "read:combos"],
  airoute_get_provider_metrics: ["read:health"],
  airoute_best_combo_for_task: ["read:combos", "read:health"],
  airoute_explain_route: ["read:health", "read:usage"],
  airoute_get_session_snapshot: ["read:usage"],
  airoute_db_health_check: ["read:health", "write:resilience"],
  airoute_sync_pricing: ["pricing:write"],
  airoute_cache_stats: ["read:cache"],
  airoute_cache_flush: ["write:cache"],
  airoute_compression_status: ["read:compression"],
  airoute_compression_configure: ["write:compression"],
  airoute_set_compression_engine: ["write:compression"],
  airoute_list_compression_combos: ["read:compression"],
  airoute_compression_combo_stats: ["read:compression"],
  airoute_ccr_store: ["write:compression"],
  airoute_ccr_retrieve: ["read:compression"],
  airoute_ccr_inspect: ["read:compression"],
  airoute_ccr_list: ["read:compression"],
  airoute_ccr_delete: ["write:compression"],
  airoute_ccr_stats: ["read:compression"],
  airoute_oneproxy_fetch: ["read:proxies"],
  airoute_oneproxy_rotate: ["read:proxies"],
  airoute_oneproxy_stats: ["read:proxies"],

  // Web-session pool observability (read) + lifecycle (write)
  airoute_pool_status: ["read:health"],
  airoute_pool_sessions: ["read:health"],
  airoute_pool_health: ["read:health"],
  airoute_pool_reset: ["write:resilience"],
  airoute_pool_warm: ["write:resilience"],
  // Stealth browser pool observability (#3368 PR7)
  airoute_browser_pool_status: ["read:health"],
} as const;
