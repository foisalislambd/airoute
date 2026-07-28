"use client";

/**
 * CloudSyncStatus — Compact sync status indicator for the header
 *
 * Shows cloud sync connection state with a small icon + label.
 * Fetches status from /api/sync/cloud periodically.
 * Listens for 'cloud-status-changed' events to re-poll immediately.
 *
 * @module shared/components/CloudSyncStatus
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/shared/utils/cn";

// #6147 — user-facing labels renamed from "Cloud …" to "Remote Settings Sync"
// wording (this feature syncs the operator's own settings to their own remote
// store — it is not a cloud/telemetry service). Internal state keys, the
// `cloud_*` material icons and the cloudSync.* wiring are intentionally kept.
const STATUS_CONFIG = {
  connected: { icon: "cloud_done", color: "text-green-500", labelKey: "synced" },
  syncing: { icon: "cloud_sync", color: "text-blue-400 animate-pulse", labelKey: "syncing" },
  disconnected: { icon: "cloud_off", color: "text-amber-500", labelKey: "off" },
  error: { icon: "cloud_off", color: "text-red-400", labelKey: "error" },
  disabled: { icon: "cloud_off", color: "text-text-muted/50", labelKey: "disabled" },
};

export default function CloudSyncStatus({
  collapsed = false,
  variant = "sidebar",
}: {
  collapsed?: boolean;
  /** `header` = compact chip for the top bar; `sidebar` kept for callers. */
  variant?: "header" | "sidebar";
}) {
  const t = useTranslations("cloudSyncStatus");
  const [status, setStatus] = useState("disabled");
  const [lastSync, setLastSync] = useState(null);
  const mountedRef = useRef(true);
  const router = useRouter();
  const isHeader = variant === "header";

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/cloud");
      if (!mountedRef.current) return;
      if (!res.ok) {
        setStatus("disconnected");
        return;
      }
      const data = await res.json();
      if (!mountedRef.current) return;

      if (!data.enabled) setStatus("disabled");
      else if (data.syncing) setStatus("syncing");
      else if (data.connected) {
        setStatus("connected");
        if (data.lastSync) setLastSync(new Date(data.lastSync));
      } else setStatus("disconnected");
    } catch {
      if (mountedRef.current) setStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Schedule initial poll outside of effect body to avoid setState-in-effect lint
    queueMicrotask(poll);
    const interval = setInterval(poll, 30000);

    // Listen for immediate re-poll events from EndpointPageClient
    const handleCloudChange = () => {
      setTimeout(poll, 500); // Small delay to let backend settle
    };
    globalThis.addEventListener("cloud-status-changed", handleCloudChange);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      globalThis.removeEventListener("cloud-status-changed", handleCloudChange);
    };
  }, [poll]);

  // Don't render if cloud sync is disabled
  if (status === "disabled") return null;

  const config = STATUS_CONFIG[status];
  const label = t(config.labelKey);
  const showLabel = isHeader ? true : !collapsed;

  return (
    <button
      type="button"
      onClick={() => router.push("/dashboard/endpoint")}
      className={cn(
        "flex items-center gap-2 text-xs transition-colors cursor-pointer",
        isHeader
          ? "h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          : "w-full rounded-lg px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
      )}
      title={
        lastSync
          ? t("lastSync", {
              status: status === "connected" ? t("connected") : t("disconnected"),
              time: lastSync.toLocaleTimeString(),
            })
          : label
      }
      aria-label={t("statusLabel", { status: label })}
    >
      <span className={`material-symbols-outlined text-[16px] ${config.color}`} aria-hidden="true">
        {config.icon}
      </span>
      {showLabel && (
        <span
          className={cn(
            "truncate",
            isHeader ? "hidden sm:inline" : "",
            status === "connected" ? "text-green-500" : "text-text-muted"
          )}
        >
          {label}
        </span>
      )}
    </button>
  );
}
