"use client";

/**
 * Breadcrumbs — ZenPanel-clean path trail for the dashboard shell.
 */

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

const PATH_LABELS = {
  dashboard: "dashboard",
  providers: "providers",
  combos: "combos",
  settings: "settings",
  general: "general",
  appearance: "appearance",
  ai: "ai",
  routing: "routing",
  resilience: "resilience",
  advanced: "advanced",
  "access-tokens": "accessTokens",
  "feature-flags": "featureFlags",
  logs: "logs",
  "audit-log": "auditLog",
  console: "console",
  logger: "logger",
  translator: "translator",
  playground: "playground",
  add: "add",
  edit: "edit",
  keys: "apiKeys",
  models: "models",
  "cli-code": "cliCode",
  "cli-agents": "cliAgents",
  "acp-agents": "acpAgents",
  endpoint: "endpoint",
  "api-manager": "apiManager",
  context: "context",
  compression: "compression",
  services: "services",
  analytics: "analytics",
  costs: "costs",
  health: "health",
  runtime: "runtime",
  webhooks: "webhooks",
  home: "home",
  activity: "activity",
  "agent-skills": "agentSkills",
  "combo-health": "comboHealth",
  evals: "evals",
  search: "search",
  utilization: "utilization",
  "api-endpoints": "apiEndpoints",
  audit: "audit",
  a2a: "a2a",
  mcp: "mcp",
  batch: "batch",
  files: "files",
  media: "media",
  cache: "cache",
  changelog: "changelog",
  chaos: "chaos",
  "cloud-agents": "cloudAgents",
  live: "live",
  studio: "studio",
  aggressive: "aggressive",
  caveman: "caveman",
  ccr: "ccr",
  headroom: "headroom",
  lite: "lite",
  llmlingua: "llmlingua",
  omniglyph: "omniglyph",
  rtk: "rtk",
  "session-dedup": "sessionDedup",
  ultra: "ultra",
  budget: "budget",
  pricing: "pricing",
  "quota-share": "quotaShare",
  discovery: "discovery",
  "free-provider-rankings": "freeProviderRankings",
  "free-tiers": "freeTiers",
  gamification: "gamification",
  leaderboard: "leaderboard",
  limits: "limits",
  profile: "profile",
  plugins: "plugins",
  "provider-stats": "providerStats",
  new: "new",
  quota: "quota",
  relay: "relay",
  "search-tools": "searchTools",
  security: "security",
  sidebar: "sidebar",
  tokens: "tokens",
  tools: "tools",
  "agent-bridge": "agentBridge",
  "traffic-inspector": "trafficInspector",
  usage: "usage",
};

function getLabel(segment, t) {
  const key = PATH_LABELS[segment];
  return key ? t(key) : segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations("breadcrumbs");
  if (!pathname || pathname === "/dashboard" || pathname === "/home") return null;

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, idx) => ({
    label: getLabel(seg, t),
    href: "/" + segments.slice(0, idx + 1).join("/"),
    isLast: idx === segments.length - 1,
  }));

  return (
    <nav
      aria-label={t("ariaLabel")}
      className="mb-4 flex flex-wrap items-center gap-1.5 text-xs sm:mb-5 sm:text-[13px]"
    >
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-gray-300 dark:text-gray-600" aria-hidden>
              /
            </span>
          )}
          {crumb.isLast ? (
            <span aria-current="page" className="font-medium text-gray-900 dark:text-white">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="text-gray-500 transition hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-300"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
