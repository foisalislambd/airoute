"use client";

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { getActiveSidebarHref } from "@/shared/utils/sidebarRouteMatch";
import { filterSidebarSectionsByQuery } from "@/shared/utils/sidebarSearch";
import {
  expandActiveSection,
  hydrateExpandedSections,
  toggleExpandedSection,
} from "@/shared/utils/sidebarExpansionState";
import { APP_CONFIG } from "@/shared/constants/appConfig";
import Button from "./Button";
import Input from "./Input";
import { ConfirmModal } from "./Modal";
import CloudSyncStatus from "./CloudSyncStatus";
import { useTranslations } from "next-intl";
import {
  HIDDEN_SIDEBAR_GROUP_LABELS_SETTING_KEY,
  normalizeHiddenSidebarGroupLabels,
} from "@/shared/constants/sidebarGroupVisibility";
import {
  HIDDEN_SIDEBAR_ITEMS_SETTING_KEY,
  SIDEBAR_SETTINGS_UPDATED_EVENT,
  SIDEBAR_SECTION_ORDER_KEY,
  SIDEBAR_ITEM_ORDER_KEY,
  SIDEBAR_SECTIONS,
  normalizeHiddenSidebarItems,
  applySectionOrder,
  applyItemOrder,
  getSidebarIconAccent,
  type SidebarSectionId,
  type SidebarItemDefinition,
  type SidebarItemGroup,
  type SidebarItemOrder,
} from "@/shared/constants/sidebarVisibility";

const isE2EMode = process.env.NEXT_PUBLIC_AIROUTE_E2E_MODE === "1";
const DEFAULT_EXPANDED: SidebarSectionId = "omni-proxy";
const EXPANDED_SECTIONS_KEY = "sidebar-expanded-sections";
const PINNED_SECTIONS_KEY = "sidebar-pinned-sections";

type SidebarGlyphStyle = CSSProperties & {
  "--sidebar-icon-accent": string;
  color: string;
};

type SidebarProps = {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isMacElectron?: boolean;
  /** When true, sidebar is position:fixed (desktop ZenPanel shell). */
  fixed?: boolean;
  /** Pixel width for fixed / drawer shell. */
  width?: number;
};

type HoveredItem = { id: string; label: string; x: number; y: number } | null;

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed as T;
    }
  } catch {}
  return fallback;
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export default function Sidebar({
  onClose,
  collapsed = false,
  onToggleCollapse,
  isMacElectron = false,
  fixed = false,
  width,
}: SidebarProps) {
  const getIconStyle = (itemId: string): SidebarGlyphStyle => {
    const accent = getSidebarIconAccent(itemId);
    return {
      "--sidebar-icon-accent": accent,
      color: accent,
    };
  };
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const tc = useTranslations("common");
  const sidebarRef = useRef<HTMLElement>(null);
  const [showShutdownModal, setShowShutdownModal] = useState(false);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [hiddenSidebarItems, setHiddenSidebarItems] = useState<string[]>([]);
  const [hiddenSidebarGroupLabels, setHiddenSidebarGroupLabels] = useState<string[]>([]);
  const [sidebarSectionOrder, setSidebarSectionOrder] = useState<SidebarSectionId[]>([]);
  const [sidebarItemOrder, setSidebarItemOrder] = useState<SidebarItemOrder>({});
  const [customAppName, setCustomAppName] = useState<string | null>(null);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<SidebarSectionId>>(
    new Set([DEFAULT_EXPANDED])
  );
  const [pinnedSections, setPinnedSections] = useState<Set<SidebarSectionId>>(new Set());
  const [sidebarExpansionLoaded, setSidebarExpansionLoaded] = useState(false);
  const skipInitialActiveExpansion = useRef(false);
  const [hoveredItem, setHoveredItem] = useState<HoveredItem>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Load persisted state on mount. A stored [] intentionally means "all sections collapsed".
  useEffect(() => {
    const storedExpanded = loadFromStorage<SidebarSectionId[]>(EXPANDED_SECTIONS_KEY, [
      DEFAULT_EXPANDED,
    ]);
    const pinnedRaw = (() => {
      try {
        return localStorage.getItem(PINNED_SECTIONS_KEY);
      } catch {
        return null;
      }
    })();
    const storedPinned: SidebarSectionId[] =
      pinnedRaw !== null
        ? (JSON.parse(pinnedRaw) as SidebarSectionId[])
        : (SIDEBAR_SECTIONS.filter((s) => s.defaultPinned).map((s) => s.id) as SidebarSectionId[]);

    const initialPinned = new Set<SidebarSectionId>(storedPinned);
    const initialExpanded = hydrateExpandedSections(storedExpanded, initialPinned);

    skipInitialActiveExpansion.current = storedExpanded.length === 0;
    setExpandedSections(initialExpanded);
    setPinnedSections(initialPinned);
    setSidebarExpansionLoaded(true);
  }, []);

  useEffect(() => {
    const applySettings = (data) => {
      setShowDebug(data?.debugMode === true);
      setHiddenSidebarItems(normalizeHiddenSidebarItems(data?.[HIDDEN_SIDEBAR_ITEMS_SETTING_KEY]));
      setHiddenSidebarGroupLabels(
        normalizeHiddenSidebarGroupLabels(data?.[HIDDEN_SIDEBAR_GROUP_LABELS_SETTING_KEY])
      );
      setCustomAppName(data?.instanceName || null);
      setCustomLogo(data?.customLogoBase64 || data?.customLogoUrl || null);
    };

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        applySettings(data);
        if (Array.isArray(data?.[SIDEBAR_SECTION_ORDER_KEY])) {
          setSidebarSectionOrder(data[SIDEBAR_SECTION_ORDER_KEY] as SidebarSectionId[]);
        }
        if (data?.[SIDEBAR_ITEM_ORDER_KEY] && typeof data[SIDEBAR_ITEM_ORDER_KEY] === "object") {
          setSidebarItemOrder(data[SIDEBAR_ITEM_ORDER_KEY] as SidebarItemOrder);
        }
      })
      .catch(() => {});

    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      if ("debugMode" in detail) setShowDebug(detail.debugMode === true);
      if (HIDDEN_SIDEBAR_ITEMS_SETTING_KEY in detail) {
        setHiddenSidebarItems(
          normalizeHiddenSidebarItems(detail[HIDDEN_SIDEBAR_ITEMS_SETTING_KEY])
        );
      }
      if (HIDDEN_SIDEBAR_GROUP_LABELS_SETTING_KEY in detail) {
        setHiddenSidebarGroupLabels(
          normalizeHiddenSidebarGroupLabels(detail[HIDDEN_SIDEBAR_GROUP_LABELS_SETTING_KEY])
        );
      }
      if (SIDEBAR_SECTION_ORDER_KEY in detail && Array.isArray(detail[SIDEBAR_SECTION_ORDER_KEY])) {
        setSidebarSectionOrder(detail[SIDEBAR_SECTION_ORDER_KEY] as SidebarSectionId[]);
      }
      if (
        SIDEBAR_ITEM_ORDER_KEY in detail &&
        detail[SIDEBAR_ITEM_ORDER_KEY] &&
        typeof detail[SIDEBAR_ITEM_ORDER_KEY] === "object"
      ) {
        setSidebarItemOrder(detail[SIDEBAR_ITEM_ORDER_KEY] as SidebarItemOrder);
      }
      if ("instanceName" in detail) setCustomAppName((detail.instanceName as string) || null);
      if ("customLogoBase64" in detail) {
        setCustomLogo((detail.customLogoBase64 as string) || null);
      } else if ("customLogoUrl" in detail) {
        setCustomLogo((detail.customLogoUrl as string) || null);
      }
    };

    window.addEventListener(SIDEBAR_SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener);
    return () =>
      window.removeEventListener(
        SIDEBAR_SETTINGS_UPDATED_EVENT,
        handleSettingsUpdated as EventListener
      );
  }, []);

  const getSidebarLabel = (key: string, fallback: string) =>
    typeof t.has === "function" && t.has(key) ? t(key) : fallback;

  const resolveItem = (item: SidebarItemDefinition, hidden: Set<string>) => {
    if (hidden.has(item.id)) return null;
    const subtitle = item.subtitleKey
      ? getSidebarLabel(item.subtitleKey, item.subtitleFallback ?? "")
      : item.subtitleFallback;
    return {
      ...item,
      label: getSidebarLabel(item.i18nKey, item.labelFallback ?? item.id),
      subtitle: subtitle || undefined,
    };
  };

  const hiddenSidebarSet = new Set(hiddenSidebarItems);
  const hiddenSidebarGroupLabelsSet = new Set(hiddenSidebarGroupLabels);

  const orderedSections = applySectionOrder(
    SIDEBAR_SECTIONS.filter((section) => section.visibility !== "debug" || showDebug),
    sidebarSectionOrder
  );

  const visibleSections = orderedSections
    .map((section) => {
      const orderedChildren = applyItemOrder(
        section.children,
        sidebarItemOrder[section.id as SidebarSectionId] ?? []
      );

      const children = orderedChildren
        .map((child) => {
          if ("type" in child && child.type === "group") {
            const items = child.items
              .map((item) => resolveItem(item, hiddenSidebarSet))
              .filter(Boolean) as (SidebarItemDefinition & { label: string })[];
            if (items.length === 0) return null;
            // Smart-grouping: single visible item → inline flat (no group header)
            if (items.length === 1) return items[0];
            return {
              ...child,
              title: getSidebarLabel(child.titleKey, child.titleFallback),
              separatorHidden: hiddenSidebarGroupLabelsSet.has(child.id),
              items,
            } as SidebarItemGroup & {
              title: string;
              separatorHidden: boolean;
              items: (SidebarItemDefinition & { label: string })[];
            };
          }
          return resolveItem(child as SidebarItemDefinition, hiddenSidebarSet);
        })
        .filter(Boolean);

      return {
        ...section,
        title: getSidebarLabel(section.titleKey, section.titleFallback),
        children,
      };
    })
    .filter((section) => {
      const allItems = section.children.flatMap((child: any) =>
        child.type === "group" ? child.items : [child]
      );
      return allItems.length > 0;
    });

  const allVisibleItems = visibleSections.flatMap((section) =>
    section.children.flatMap((child: any) => (child.type === "group" ? child.items : [child]))
  );

  const activeHref = getActiveSidebarHref(pathname, allVisibleItems);

  const isSearching = searchQuery.trim().length > 0;
  const displaySections = isSearching
    ? filterSidebarSectionsByQuery(visibleSections, searchQuery)
    : visibleSections;

  // Keep the active page visible while preserving accordion semantics for unpinned sections.
  useEffect(() => {
    if (collapsed || !sidebarExpansionLoaded) return;
    if (skipInitialActiveExpansion.current) {
      skipInitialActiveExpansion.current = false;
      return;
    }
    for (const section of visibleSections) {
      const sectionItems = section.children.flatMap((child: any) =>
        child.type === "group" ? child.items : [child]
      );
      if (sectionItems.some((item: any) => !item.external && item.href === activeHref)) {
        setExpandedSections((prev) => {
          const next = expandActiveSection(pinnedSections, section.id as SidebarSectionId);
          if ([...next].every((id) => prev.has(id)) && next.size === prev.size) return prev;
          saveToStorage(EXPANDED_SECTIONS_KEY, [...next]);
          return next;
        });
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHref, collapsed, pinnedSections, sidebarExpansionLoaded]);

  // Accordion toggle: opening a section closes all non-pinned sections
  const toggleSection = useCallback(
    (sectionId: SidebarSectionId) => {
      setExpandedSections((prev) => {
        const next = toggleExpandedSection(prev, pinnedSections, sectionId);
        saveToStorage(EXPANDED_SECTIONS_KEY, [...next]);
        return next;
      });
    },
    [pinnedSections]
  );

  const togglePin = useCallback((sectionId: SidebarSectionId) => {
    setPinnedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
        // Ensure the section is expanded when pinned
        setExpandedSections((prevExp) => {
          if (prevExp.has(sectionId)) return prevExp;
          const nextExp = new Set(prevExp);
          nextExp.add(sectionId);
          saveToStorage(EXPANDED_SECTIONS_KEY, [...nextExp]);
          return nextExp;
        });
      }
      saveToStorage(PINNED_SECTIONS_KEY, [...next]);
      return next;
    });
  }, []);

  const handleShutdown = async () => {
    setIsShuttingDown(true);
    try {
      await fetch("/api/shutdown", { method: "POST" });
    } catch (e) {
      // Expected to fail as server shuts down
    }
    setIsShuttingDown(false);
    setShowShutdownModal(false);
    setIsDisconnected(true);
  };

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await fetch("/api/restart", { method: "POST" });
    } catch (e) {
      // Expected to fail as server restarts
    }
    setIsRestarting(false);
    setShowRestartModal(false);
    setIsDisconnected(true);
    setTimeout(() => globalThis.location.reload(), 3000);
  };

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>, id: string, label: string) => {
      if (!collapsed) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const sidebarRect = sidebarRef.current?.getBoundingClientRect();
      setHoveredItem({
        id,
        label,
        x: (sidebarRect?.right ?? 64) + 8,
        y: rect.top + rect.height / 2,
      });
    },
    [collapsed]
  );

  const handleMouseLeave = useCallback(() => setHoveredItem(null), []);

  const renderNavLink = (item) => {
    const active = !item.external && activeHref === item.href;
    const className = cn(
      "app-nav-item group",
      collapsed ? "justify-center px-0" : "",
      active ? "app-nav-item-active" : "app-nav-item-idle"
    );
    const iconClassName = cn(
      "material-symbols-outlined text-[22px] shrink-0",
      active ? "fill-1 text-white" : "text-gray-500 group-hover:text-gray-700 dark:text-gray-400"
    );
    const content = (
      <>
        <span className={iconClassName} style={active ? undefined : getIconStyle(item.id)}>
          {item.icon}
        </span>
        {!collapsed && (
          <div className="flex min-w-0 flex-col">
            <span className={cn("truncate text-[15px] font-medium", active && "text-white")}>
              {item.label}
            </span>
            {item.subtitle && (
              <span
                className={cn(
                  "truncate text-[10px]",
                  active ? "text-white/70" : "text-text-muted/60"
                )}
              >
                {item.subtitle}
              </span>
            )}
          </div>
        )}
      </>
    );
    const sharedProps = {
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => handleMouseEnter(e, item.id, item.label),
      onMouseLeave: handleMouseLeave,
      title: collapsed ? item.label : undefined,
      "aria-current": active ? ("page" as const) : undefined,
    };

    if (item.external) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className={className}
          {...sharedProps}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        onClick={onClose}
        className={className}
        {...sharedProps}
      >
        {content}
      </Link>
    );
  };

  const resolvedWidth = width ?? (collapsed ? 80 : 260);

  return (
    <>
      <aside
        ref={sidebarRef}
        className={cn(
          "app-sidebar min-h-0",
          fixed ? "app-sidebar-docked hidden lg:flex" : "flex h-full",
          collapsed && "app-sidebar-collapsed"
        )}
        style={{
          width: resolvedWidth,
          paddingTop: isMacElectron ? "var(--desktop-safe-top)" : undefined,
        }}
        aria-label="AIRoute navigation"
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-primary focus:p-3 focus:text-white"
        >
          {t("skipToContent")}
        </a>

        <div
          className={cn(
            "app-topbar flex items-center gap-2 px-3",
            collapsed ? "justify-center" : "gap-3 px-4"
          )}
        >
          <Link
            href="/home"
            prefetch={false}
            onClick={onClose}
            className={cn(
              "flex min-w-0 items-center gap-3",
              collapsed ? "justify-center" : "flex-1"
            )}
            title={customAppName || APP_CONFIG.name}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-500 text-base font-bold text-white">
              {customLogo ? (
                <img
                  src={customLogo}
                  alt={customAppName || APP_CONFIG.name}
                  className="size-6 object-contain"
                />
              ) : (
                (customAppName || APP_CONFIG.name || "A").charAt(0).toUpperCase()
              )}
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-gray-900 dark:text-white">
                  {customAppName || APP_CONFIG.name}
                </p>
                <p className="truncate text-xs text-gray-500">v{APP_CONFIG.version}</p>
              </div>
            )}
          </Link>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 lg:hidden"
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="px-3 pb-2 pt-3">
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tc("search")}
              aria-label={tc("search")}
              icon="search"
              className="gap-0"
              inputClassName="rounded-lg border-gray-200 bg-gray-50 py-2 text-sm dark:border-gray-800 dark:bg-white/5"
            />
          </div>
        )}

        <nav
          aria-label={t("mainNavigation")}
          className={cn(
            "no-scrollbar min-h-0 flex-1 overflow-y-auto py-3",
            collapsed ? "px-2 space-y-0.5" : "px-3"
          )}
        >
          {isSearching && displaySections.length === 0 && (
            <p className="px-2 py-3 text-xs text-text-muted/60">{tc("noResults")}</p>
          )}
          {displaySections.map((section, idx) => {
            const sectionId = section.id as SidebarSectionId;
            const isExpanded = isSearching || expandedSections.has(sectionId);
            const isPinned = pinnedSections.has(sectionId);
            const isFirst = idx === 0;
            const sectionItems = section.children.flatMap((child: any) =>
              child.type === "group" ? child.items : [child]
            );

            // Collapsed (mini) mode: flat items with dividers between sections
            if (collapsed) {
              return (
                <div key={section.id}>
                  {!isFirst && (
                    <div className="border-t border-black/5 dark:border-white/5 my-1.5" />
                  )}
                  {sectionItems.map(renderNavLink)}
                </div>
              );
            }

            // Sections without a visible title (e.g. Home) render items directly
            if (section.showTitle === false) {
              return (
                <div key={section.id} className={cn("space-y-0.5", !isFirst && "mt-1")}>
                  {sectionItems.map(renderNavLink)}
                </div>
              );
            }

            // Expanded mode: collapsible section with pin
            return (
              <div key={section.id} className={isFirst ? "space-y-0.5" : "mt-2"}>
                <div
                  className="flex items-center gap-0.5 px-2 py-1 rounded-md hover:bg-surface/30 transition-colors cursor-pointer group/header"
                  onClick={() => toggleSection(sectionId)}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <span className="flex-1 text-[10px] font-semibold text-text-muted/60 uppercase tracking-wider group-hover/header:text-text-muted/90 transition-colors">
                    {section.title}
                  </span>

                  {/* Pin button — right side near chevron */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(sectionId);
                    }}
                    title={isPinned ? t("unpinSection") : t("pinSectionOpen")}
                    className={cn(
                      "p-0.5 rounded transition-all shrink-0",
                      isPinned
                        ? "text-primary opacity-100"
                        : "text-text-muted/30 opacity-0 group-hover/header:opacity-100 hover:text-text-muted/70"
                    )}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "10px",
                        ...(isPinned ? { fontVariationSettings: "'FILL' 1" } : {}),
                      }}
                    >
                      push_pin
                    </span>
                  </button>

                  <span
                    className={cn(
                      "material-symbols-outlined text-[14px] text-text-muted/40 transition-all duration-200 group-hover/header:text-text-muted/70 shrink-0",
                      isExpanded && "rotate-180"
                    )}
                  >
                    expand_more
                  </span>
                </div>

                {isExpanded && (
                  <div className="mt-0.5 space-y-0.5">
                    {section.children.map((child: any) => {
                      if (child.type === "group") {
                        if (child.items.length === 0) return null;
                        const separatorHidden = child.separatorHidden === true;
                        return (
                          <div key={child.id} className={separatorHidden ? "mt-0.5" : "mt-2"}>
                            {!separatorHidden && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 mb-0.5">
                                <div className="h-px flex-1 bg-black/8 dark:bg-white/8" />
                                <span className="text-[8px] font-semibold text-text-muted/40 uppercase tracking-widest">
                                  {child.title}
                                </span>
                              </div>
                            )}
                            {child.items.map(renderNavLink)}
                          </div>
                        );
                      }
                      return renderNavLink(child);
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {!isE2EMode && <CloudSyncStatus collapsed={collapsed} />}

        {onToggleCollapse && !onClose && (
          <div className={cn("shrink-0 px-2 pb-1", collapsed && "flex justify-center")}>
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? t("expandSidebar") : t("collapseSidebar")}
              aria-expanded={!collapsed}
              aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5",
                collapsed ? "h-10 w-10 justify-center" : "mt-1 w-full px-3 py-2.5"
              )}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {collapsed ? "chevron_right" : "chevron_left"}
              </span>
              {!collapsed && <span>{t("collapseSidebar")}</span>}
            </button>
          </div>
        )}

        <div
          className={cn(
            "shrink-0 border-t border-black/5 dark:border-white/5",
            collapsed ? "flex flex-col gap-1 p-2" : "flex gap-2 p-2"
          )}
          style={{
            paddingBottom: isMacElectron ? "calc(0.5rem + var(--desktop-safe-bottom))" : undefined,
          }}
        >
          <button
            onClick={() => setShowRestartModal(true)}
            title={t("restart")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg font-medium transition-all",
              "text-amber-500 hover:bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40",
              collapsed ? "p-2" : "flex-1 min-w-0 px-2 py-1.5 text-xs"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            {!collapsed && <span className="truncate">{t("restart")}</span>}
          </button>
          <button
            onClick={() => setShowShutdownModal(true)}
            title={t("shutdown")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg font-medium transition-all",
              "text-red-500 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40",
              collapsed ? "p-2" : "flex-1 min-w-0 px-2 py-1.5 text-xs"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">power_settings_new</span>
            {!collapsed && <span className="truncate">{t("shutdown")}</span>}
          </button>
        </div>
      </aside>

      {/* Styled tooltip for collapsed (mini) sidebar */}
      {collapsed && hoveredItem && (
        <div
          className="fixed z-[200] pointer-events-none flex items-center"
          style={{ left: hoveredItem.x, top: hoveredItem.y, transform: "translateY(-50%)" }}
        >
          <div className="w-0 h-0 border-t-[5px] border-b-[5px] border-r-[6px] border-t-transparent border-b-transparent border-r-sidebar dark:border-r-sidebar" />
          <div className="px-2.5 py-1.5 bg-sidebar text-text-main text-xs font-medium rounded-md shadow-lg border border-black/10 dark:border-white/10 whitespace-nowrap">
            {hoveredItem.label}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showShutdownModal}
        onClose={() => setShowShutdownModal(false)}
        onConfirm={handleShutdown}
        title={t("shutdown")}
        message={t("shutdownConfirm")}
        confirmText={t("shutdown")}
        cancelText={tc("cancel")}
        variant="danger"
        loading={isShuttingDown}
      />

      <ConfirmModal
        isOpen={showRestartModal}
        onClose={() => setShowRestartModal(false)}
        onConfirm={handleRestart}
        title={t("restart")}
        message={t("restartConfirm")}
        confirmText={t("restart")}
        cancelText={tc("cancel")}
        variant="warning"
        loading={isRestarting}
      />

      {isDisconnected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center p-8">
            <div className="flex items-center justify-center size-16 rounded-full bg-red-500/20 text-red-500 mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">power_off</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">{t("serverDisconnected")}</h2>
            <p className="text-text-muted mb-6">{t("serverDisconnectedMsg")}</p>
            <Button variant="secondary" onClick={() => globalThis.location.reload()}>
              {t("reloadPage")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
