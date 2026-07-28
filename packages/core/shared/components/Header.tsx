"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

const subscribePlatform = () => () => {};
const getPlatformIsMac = () => {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || navigator.userAgent;
  return /Mac|iPhone|iPad|iPod/.test(platform);
};
const getPlatformIsMacServer = () => false;
import ThemeToggle from "./ThemeToggle";
import TokenHealthBadge from "./TokenHealthBadge";
import DegradationBadge from "./DegradationBadge";
import LanguageSelector from "./LanguageSelector";
import ProviderIcon from "./ProviderIcon";
import { useTranslations } from "next-intl";
import {
  OAUTH_PROVIDERS,
  APIKEY_PROVIDERS,
  NOAUTH_PROVIDERS,
  CLAUDE_CODE_COMPATIBLE_PREFIX,
  OPENAI_COMPATIBLE_PREFIX,
  ANTHROPIC_COMPATIBLE_PREFIX,
} from "@/shared/constants/providers";
import {
  SIDEBAR_SECTIONS,
  getSectionItems,
  type SidebarItemDefinition,
  type HideableSidebarItemId,
} from "@/shared/constants/sidebarVisibility";
import { useIsElectron } from "@/shared/hooks/useElectron";

const isE2EMode = process.env.NEXT_PUBLIC_AIROUTE_E2E_MODE === "1";

// Map sidebar item id → header description i18n key
// "omni-skills" is an extended key for the /dashboard/omni-skills route (graceful fallback during deploy)
const HEADER_DESCRIPTIONS: Partial<Record<HideableSidebarItemId | "omni-skills", string>> = {
  home: "homeDescription",
  endpoints: "endpointDescription",
  "api-manager": "apiManagerDescription",
  providers: "providerDescription",
  combos: "comboDescription",
  batch: "batchDescription",
  costs: "costsDescription",
  analytics: "analyticsDescription",
  cache: "cacheDescription",
  quota: "limitsDescription",
  runtime: "runtimeDescription",
  media: "mediaDescription",
  "cli-code": "cliToolsDescription",
  "cli-agents": "agentsDescription",
  "acp-agents": "agentsDescription",
  "cloud-agents": "cloudAgentsDescription",
  memory: "memoryDescription",
  skills: "skillsDescription",
  "agent-skills": "agentSkillsDescription",
  "omni-skills": "omniSkillsDescription",
  settings: "settingsDescription",
  "context-caveman": "contextCavemanDescription",
  "context-rtk": "contextRtkDescription",
  "context-combos": "contextCombosDescription",
  translator: "translatorDescription",
  playground: "playgroundDescription",
  "search-tools": "searchToolsDescription",
  logs: "logsDescription",
  audit: "auditDescription",
  webhooks: "webhooksDescription",
  health: "healthDescription",
  proxy: "proxyDescription",
  changelog: "changelogDescription",
  // Protocols
  mcp: "mcpDescription",
  a2a: "a2aDescription",
  "api-endpoints": "apiEndpointsDescription",
  // Agents & AI sub-pages
  "batch-files": "batchFilesDescription",
  // Analytics sub-pages
  "analytics-evals": "analyticsEvalsDescription",
  "analytics-search": "analyticsSearchDescription",
  "analytics-utilization": "analyticsUtilizationDescription",
  "analytics-combo-health": "analyticsComboHealthDescription",
  "analytics-compression": "analyticsCompressionDescription",
  // Costs sub-pages
  "costs-budget": "costsBudgetDescription",
  "costs-pricing": "costsPricingDescription",
  // Logs sub-pages
  "logs-proxy": "logsProxyDescription",
  "logs-console": "logsConsoleDescription",
  "logs-activity": "logsActivityDescription",
  // Audit sub-pages
  "audit-mcp": "auditMcpDescription",
  // Settings sub-pages
  "settings-general": "settingsGeneralDescription",
  "settings-appearance": "settingsAppearanceDescription",
  "settings-ai": "settingsAiDescription",
  "settings-security": "settingsSecurityDescription",
  "settings-routing": "settingsRoutingDescription",
  "settings-resilience": "settingsResilienceDescription",
  "settings-cache": "settingsCacheDescription",
  "settings-advanced": "settingsAdvancedDescription",
  // Proxy sub-pages
  "mitm-proxy": "mitmProxyDescription",
  "1proxy": "oneProxyDescription",
};

// Build href → sidebar item lookup (non-external items only)
const sidebarByHref = new Map<string, SidebarItemDefinition>();
for (const section of SIDEBAR_SECTIONS) {
  for (const item of getSectionItems(section)) {
    if (!item.external) sidebarByHref.set(item.href, item);
  }
}

function getSidebarItem(pathname: string): SidebarItemDefinition | undefined {
  const exact = sidebarByHref.get(pathname);
  if (exact) return exact;
  // Longest prefix match
  let best: SidebarItemDefinition | undefined;
  let bestLen = 0;
  for (const [href, item] of sidebarByHref) {
    if (pathname.startsWith(href) && href.length > bestLen) {
      best = item;
      bestLen = href.length;
    }
  }
  return best;
}

type HeaderProps = {
  onMenuClick?: () => void;
  onOpenCommandPalette?: () => void;
  showMenuButton?: boolean;
};

type PageInfo = {
  title: string;
  description: string;
  icon?: string;
  providerId?: string;
};

function usePageInfo(pathname: string | null): PageInfo {
  const ts = useTranslations("sidebar");
  const th = useTranslations("header");

  if (!pathname) return { title: "", description: "" };

  // Special: provider detail page /dashboard/providers/[id]
  const providerMatch = pathname.match(/\/providers\/([^/]+)$/);
  if (providerMatch) {
    const pid = providerMatch[1];
    const info = OAUTH_PROVIDERS[pid] || NOAUTH_PROVIDERS[pid] || APIKEY_PROVIDERS[pid];
    if (info) return { title: info.name, description: "", providerId: info.id };
    if (pid.startsWith(CLAUDE_CODE_COMPATIBLE_PREFIX))
      return { title: "CC Compatible", description: "", providerId: "claude" };
    if (pid.startsWith(OPENAI_COMPATIBLE_PREFIX))
      return { title: th("openaiCompatible"), description: "", providerId: "oai-cc" };
    if (pid.startsWith(ANTHROPIC_COMPATIBLE_PREFIX))
      return { title: th("anthropicCompatible"), description: "", providerId: "anthropic-m" };
  }

  // Derive from sidebar
  const item = getSidebarItem(pathname);
  if (item) {
    const descKey = HEADER_DESCRIPTIONS[item.id];
    return {
      title: ts(item.i18nKey),
      description: descKey ? th(descKey) : "",
      icon: item.icon,
    };
  }

  return { title: "", description: "" };
}

export default function Header({
  onMenuClick,
  onOpenCommandPalette,
  showMenuButton = true,
}: HeaderProps) {
  const isMac = useSyncExternalStore(subscribePlatform, getPlatformIsMac, getPlatformIsMacServer);
  const pathname = usePathname();
  const router = useRouter();
  const isElectron = useIsElectron();
  const t = useTranslations("header");
  const { title, description, icon, providerId } = usePageInfo(pathname);
  const isMacElectron =
    isElectron &&
    typeof window !== "undefined" &&
    (window as any).electronAPI?.platform === "darwin";

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  };

  return (
    <header
      className="app-topbar sticky top-0 z-30 w-full bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:bg-gray-900/95 dark:supports-[backdrop-filter]:bg-gray-900/80"
      style={{
        paddingTop: isMacElectron ? "calc(0px + var(--desktop-safe-top))" : undefined,
        height: isMacElectron ? "calc(4rem + var(--desktop-safe-top))" : undefined,
      }}
    >
      <div className="flex h-full items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {/* Mobile menu button */}
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5 lg:hidden"
            aria-label="Open menu"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
        )}

        {/* Page title with icon - desktop */}
        <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
          {(icon || providerId) && (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              {icon ? (
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
              ) : (
                providerId && <ProviderIcon providerId={providerId} size={22} type="color" />
              )}
            </div>
          )}
          {title && (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                {title}
              </h1>
              {description && (
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Mobile title */}
        <div className="min-w-0 flex-1 lg:hidden">
          {title && (
            <h1 className="truncate text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </h1>
          )}
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 md:gap-3">
          {onOpenCommandPalette && (
            <>
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="hidden h-10 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500 transition hover:bg-white dark:border-gray-800 dark:bg-white/5 dark:hover:bg-white/10 md:inline-flex"
                title={t("quickNavigationTitle")}
                aria-label={t("openQuickNavigation")}
              >
                <span className="material-symbols-outlined text-[16px]">search</span>
                <span className="hidden text-xs lg:inline">{t("quickNavigation")}</span>
                <kbd className="hidden font-mono text-[10px] rounded border border-gray-200 bg-white px-1 py-0.5 dark:border-gray-700 dark:bg-gray-900 xl:inline-flex">
                  {isMac ? "⌘K" : "Ctrl+K"}
                </kbd>
              </button>
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 md:hidden dark:border-gray-800"
                aria-label={t("openQuickNavigation")}
              >
                <span className="material-symbols-outlined">search</span>
              </button>
            </>
          )}
          <div className="hidden sm:block">
            <LanguageSelector />
          </div>
          <ThemeToggle />
          <div className="hidden md:contents">
            {!isE2EMode && <DegradationBadge />}
            {!isE2EMode && <TokenHealthBadge />}
          </div>
          <button
            onClick={handleLogout}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-red-500/40 hover:bg-red-50 hover:text-red-500 dark:border-gray-800 dark:hover:bg-white/5"
            title={t("logout")}
            aria-label={t("logout")}
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
