"use client";

import { Suspense, useEffect, useInsertionEffect, useState } from "react";
import Sidebar from "../Sidebar";
import Header from "../Header";
import NotificationToast from "../NotificationToast";
import Breadcrumbs from "../Breadcrumbs";
import MaintenanceBanner from "../MaintenanceBanner";
import CommandPalette from "../CommandPalette";
import NavigationProgress from "../NavigationProgress";
import { useIsElectron } from "@/shared/hooks/useElectron";
import {
  installDashboardCsrfFetch,
  prefetchDashboardCsrfToken,
} from "@/shared/utils/dashboardCsrf";
import { installBasePathFetch } from "@/shared/utils/basePathFetch";
import { cn } from "@/shared/utils/cn";
import { lockBodyScroll } from "@/shared/utils/bodyScrollLock";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
const SIDEBAR_WIDTH_EXPANDED = 260;
const SIDEBAR_WIDTH_COLLAPSED = 80;
const DESKTOP_BREAKPOINT = 1024;
const isE2EMode = process.env.NEXT_PUBLIC_AIROUTE_E2E_MODE === "1";

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const isElectron = useIsElectron();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true") {
        setTimeout(() => setCollapsed(true), 0);
      }
    } catch {}
  }, []);

  const isMacElectron =
    isElectron &&
    typeof globalThis.window !== "undefined" &&
    globalThis.electronAPI?.platform === "darwin";

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.body.classList.toggle("electron-macos", isMacElectron);

    return () => {
      document.body.classList.remove("electron-macos");
    };
  }, [isMacElectron]);

  useInsertionEffect(() => {
    const uninstallBasePathFetch = installBasePathFetch();
    const uninstallDashboardCsrfFetch = installDashboardCsrfFetch();
    void prefetchDashboardCsrfToken();
    return () => {
      uninstallDashboardCsrfFetch();
      uninstallBasePathFetch();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  // Close mobile drawer + unlock scroll when crossing into desktop width
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= DESKTOP_BREAKPOINT) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    return lockBodyScroll();
  }, [sidebarOpen]);

  const handleToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    } catch {}
  };

  const desktopSidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <div className="app-shell app-main flex h-dvh w-full overflow-hidden">
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>

      {/* Desktop sidebar — in-flow so page content cannot paint underneath it */}
      <div
        className="relative z-50 hidden h-dvh shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out lg:block"
        style={{ width: desktopSidebarWidth }}
      >
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
          isMacElectron={isMacElectron}
          fixed={false}
          width={desktopSidebarWidth}
        />
      </div>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={cn(
          "fixed inset-y-0 start-0 z-50 h-dvh transform transition-transform duration-300 ease-in-out lg:hidden",
          sidebarOpen ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full"
        )}
      >
        <Sidebar
          onClose={() => setSidebarOpen(false)}
          isMacElectron={isMacElectron}
          fixed={false}
          width={Math.min(320, SIDEBAR_WIDTH_EXPANDED)}
        />
      </div>

      <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />
        {!isE2EMode && <MaintenanceBanner />}
        <main
          id="main-content"
          className="app-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        >
          <div className="app-content w-full px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="mx-auto flex h-full min-h-0 w-full max-w-[3840px] flex-col">
              <Breadcrumbs />
              <div className="min-h-0 flex-1">{children}</div>
            </div>
          </div>
        </main>
      </div>

      <NotificationToast />
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}
