"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SIDEBAR_SECTIONS,
  HIDDEN_SIDEBAR_ITEMS_SETTING_KEY,
  normalizeHiddenSidebarItems,
  type SidebarItemDefinition,
  type SidebarSectionChild,
} from "@/shared/constants/sidebarVisibility";
import { lockBodyScroll } from "@/shared/utils/bodyScrollLock";
import { cn } from "@/shared/utils/cn";

function isSidebarGroup(
  child: SidebarSectionChild
): child is Extract<SidebarSectionChild, { type: "group" }> {
  return "type" in child && child.type === "group";
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  if (!isOpen) return null;
  return <CommandPaletteDialog onClose={onClose} />;
}

interface PaletteItem {
  id: string;
  href: string;
  icon: string;
  label: string;
  subtitle?: string;
  external: boolean;
  sectionId: string;
  sectionLabel: string;
  subgroupId?: string;
  subgroupLabel?: string;
}

interface PaletteSubgroup {
  subgroupId: string | null;
  subgroupLabel: string | null;
  items: { item: PaletteItem; flatIndex: number }[];
}

interface PaletteGroup {
  sectionId: string;
  sectionLabel: string;
  subgroups: PaletteSubgroup[];
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.25rem] items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
      {children}
    </kbd>
  );
}

function CommandPaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const t = useTranslations("sidebar");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/settings", { signal: ctrl.signal })
      .then((res) => res.json())
      .then((data) => {
        setHiddenItems(
          new Set(normalizeHiddenSidebarItems(data?.[HIDDEN_SIDEBAR_ITEMS_SETTING_KEY]))
        );
      })
      .catch(() => {
        // ignore aborts and fetch failures; palette still works with empty hidden set
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => lockBodyScroll(), []);

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleTab);
    return () => dialog.removeEventListener("keydown", handleTab);
  }, []);

  const safeTranslate = useCallback(
    (key: string, fallback: string) => {
      try {
        return t(key);
      } catch {
        return fallback;
      }
    },
    [t]
  );

  const allItems = useMemo<PaletteItem[]>(
    () =>
      SIDEBAR_SECTIONS.flatMap((section) => {
        const sectionLabel = safeTranslate(section.titleKey, section.titleFallback);
        return section.children.flatMap<PaletteItem>((child) => {
          if (isSidebarGroup(child)) {
            const subgroupLabel = safeTranslate(child.titleKey, child.titleFallback);
            return child.items
              .filter((item) => !hiddenItems.has(item.id))
              .map<PaletteItem>((item) => {
                const subtitle = item.subtitleKey
                  ? safeTranslate(item.subtitleKey, "")
                  : item.subtitleFallback;
                return {
                  id: item.id,
                  href: item.href,
                  icon: item.icon,
                  label: safeTranslate(item.i18nKey, item.labelFallback ?? item.id),
                  subtitle: subtitle?.trim() ? subtitle : undefined,
                  external: item.external ?? false,
                  sectionId: section.id,
                  sectionLabel,
                  subgroupId: child.id,
                  subgroupLabel,
                };
              });
          }
          const item = child as SidebarItemDefinition;
          if (hiddenItems.has(item.id)) return [];
          const subtitle = item.subtitleKey
            ? safeTranslate(item.subtitleKey, "")
            : item.subtitleFallback;
          return [
            {
              id: item.id,
              href: item.href,
              icon: item.icon,
              label: safeTranslate(item.i18nKey, item.labelFallback ?? item.id),
              subtitle: subtitle?.trim() ? subtitle : undefined,
              external: item.external ?? false,
              sectionId: section.id,
              sectionLabel,
            },
          ];
        });
      }),
    [hiddenItems, safeTranslate]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        item.sectionLabel.toLowerCase().includes(q) ||
        item.subgroupLabel?.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  // Keep keyboard selection inside the current result set
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (filtered.length === 0) return 0;
      return Math.min(prev, filtered.length - 1);
    });
  }, [filtered.length]);

  const grouped = useMemo<PaletteGroup[]>(() => {
    const groups: PaletteGroup[] = [];
    const sectionById = new Map<string, PaletteGroup>();
    filtered.forEach((item, flatIndex) => {
      let section = sectionById.get(item.sectionId);
      if (!section) {
        section = {
          sectionId: item.sectionId,
          sectionLabel: item.sectionLabel,
          subgroups: [],
        };
        sectionById.set(item.sectionId, section);
        groups.push(section);
      }
      const itemSubgroupId = item.subgroupId ?? null;
      let subgroup = section.subgroups.find((sg) => sg.subgroupId === itemSubgroupId);
      if (!subgroup) {
        subgroup = {
          subgroupId: itemSubgroupId,
          subgroupLabel: item.subgroupLabel ?? null,
          items: [],
        };
        section.subgroups.push(subgroup);
      }
      subgroup.items.push({ item, flatIndex });
    });
    return groups;
  }, [filtered]);

  const handleNavigate = useCallback(
    (href: string, external: boolean) => {
      onClose();
      if (external) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        router.push(href);
      }
    },
    [onClose, router]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (filtered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[selectedIndex];
        if (item) handleNavigate(item.href, item.external);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filtered, selectedIndex, onClose, handleNavigate]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-flat-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const ui = (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[12vh] sm:px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] animate-in fade-in zoom-in-95 duration-150 dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-label={t("quickNavigationTitle")}
      >
        {/* Search field */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3.5 dark:border-gray-800">
          <span
            className="material-symbols-outlined shrink-0 text-[22px] text-brand-500"
            aria-hidden="true"
          >
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-[16px] text-gray-900 outline-none ring-0 placeholder:text-gray-400 !shadow-none focus:!shadow-none focus:outline-none focus:ring-0 focus-visible:!shadow-none focus-visible:outline-none focus-visible:ring-0 dark:text-white dark:placeholder:text-gray-500"
            placeholder="Search pages, settings, tools…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            aria-activedescendant={
              filtered[selectedIndex] ? `command-palette-option-${filtered[selectedIndex].id}` : undefined
            }
          />
          {query ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                close
              </span>
            </button>
          ) : (
            <Kbd>Esc</Kbd>
          )}
        </div>

        {/* Results */}
        {grouped.length > 0 ? (
          <ul
            id="command-palette-results"
            ref={listRef}
            className="app-scrollbar max-h-[min(52vh,420px)] overflow-y-auto pb-2 pt-0"
            role="listbox"
            aria-label="Search results"
          >
            {grouped.map((group) => (
              <li key={group.sectionId} role="presentation">
                <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-500">
                  {group.sectionLabel}
                </div>
                <ul role="group" aria-label={group.sectionLabel}>
                  {group.subgroups.map((subgroup) => (
                    <li
                      key={`${group.sectionId}::${subgroup.subgroupId ?? "_root"}`}
                      role="presentation"
                    >
                      {subgroup.subgroupLabel && (
                        <div className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                          {subgroup.subgroupLabel}
                        </div>
                      )}
                      <ul
                        role={subgroup.subgroupLabel ? "group" : "presentation"}
                        aria-label={subgroup.subgroupLabel ?? undefined}
                      >
                        {subgroup.items.map(({ item, flatIndex }) => {
                          const active = flatIndex === selectedIndex;
                          return (
                            <li
                              key={item.id}
                              id={`command-palette-option-${item.id}`}
                              role="option"
                              aria-selected={active}
                              data-flat-index={flatIndex}
                            >
                              <button
                                type="button"
                                className={cn(
                                  "mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
                                  subgroup.subgroupLabel && "ms-4",
                                  active
                                    ? "bg-brand-500 text-white shadow-sm shadow-brand-500/25"
                                    : "text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
                                )}
                                onClick={() => handleNavigate(item.href, item.external)}
                                onMouseEnter={() => setSelectedIndex(flatIndex)}
                              >
                                <span
                                  className={cn(
                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                    active
                                      ? "bg-white/20 text-white"
                                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                  )}
                                >
                                  <span
                                    className="material-symbols-outlined text-[18px]"
                                    aria-hidden="true"
                                  >
                                    {item.icon}
                                  </span>
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{item.label}</p>
                                  {(item.subtitle || item.sectionLabel) && (
                                    <p
                                      className={cn(
                                        "truncate text-xs",
                                        active ? "text-white/75" : "text-gray-500 dark:text-gray-400"
                                      )}
                                    >
                                      {item.subtitle || item.sectionLabel}
                                    </p>
                                  )}
                                </div>
                                {item.external && (
                                  <span
                                    className={cn(
                                      "material-symbols-outlined shrink-0 text-[16px]",
                                      active ? "text-white/80" : "text-gray-400"
                                    )}
                                    aria-hidden="true"
                                  >
                                    open_in_new
                                  </span>
                                )}
                                {active && (
                                  <span className="hidden rounded-md bg-white/20 px-1.5 py-0.5 font-mono text-[10px] text-white sm:inline">
                                    ↵
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-[24px]">search_off</span>
            </span>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">No results</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Try a different page, setting, or tool name
            </p>
          </div>
        )}

        {/* Footer hints */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-950/80">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span>navigate</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>↵</Kbd>
              <span>open</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>Esc</Kbd>
              <span>close</span>
            </span>
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return ui;
  return createPortal(ui, document.body);
}
