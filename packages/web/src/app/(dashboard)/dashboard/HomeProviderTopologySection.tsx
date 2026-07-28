"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import { Card } from "@/shared/components";
import { useLiveRequests } from "@/hooks/useLiveDashboard";
import { selectActiveRequests } from "../home/topologyUtils";
import { cn } from "@/shared/utils/cn";

const ProviderTopology = dynamic(() => import("../home/ProviderTopology"), { ssr: false });

type TopologyProvider = {
  id: string;
  provider: string;
  name?: string;
  /** Connection-health base state, so the topology can colour a node at rest. */
  status?: "active" | "error" | "idle";
};

function StatChip({
  colorClass,
  label,
  value,
}: {
  colorClass: string;
  label: string;
  value: number | string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
      <span className={cn("size-1.5 rounded-full", colorClass)} aria-hidden="true" />
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="tabular-nums text-gray-900 dark:text-white">{value}</span>
    </span>
  );
}

function LegendItem({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
      <span className={cn("size-2 rounded-full", colorClass)} aria-hidden="true" />
      {label}
    </span>
  );
}

export function HomeProviderTopologySection({
  providers,
  lastProvider,
  errorProvider,
  enabled = true,
}: {
  providers: TopologyProvider[];
  lastProvider: string;
  errorProvider: string;
  enabled?: boolean;
}) {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");
  const tAnalytics = useTranslations("analytics");
  // #4596: gate the live-WS connection so it only opens while the topology
  // section is actually shown on the home page.
  const { activeRequests: liveActiveRequests } = useLiveRequests({ enabled });
  const activeRequests = selectActiveRequests(liveActiveRequests);
  const activeProviderCount = new Set(activeRequests.map(({ provider }) => provider)).size;
  const errorCount = errorProvider ? 1 : 0;
  const connectedCount = providers.length;

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              hub
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
              {t("providerTopology")}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Live map of connected providers and routing activity
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatChip colorClass="bg-gray-400" label="Connected" value={connectedCount} />
          <StatChip colorClass="bg-green-500" label={tCommon("active")} value={activeProviderCount} />
          <StatChip
            colorClass="bg-red-500"
            label={tAnalytics("modelStatusError")}
            value={errorCount}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 px-5 py-2.5 dark:border-gray-800/80">
        <LegendItem colorClass="bg-green-500" label={tCommon("active")} />
        <LegendItem colorClass="bg-amber-500" label={tSettings("recent")} />
        <LegendItem colorClass="bg-red-500" label={tAnalytics("modelStatusError")} />
        <div className="ms-auto">
          <Link
            href="/dashboard/providers"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            Manage providers
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              arrow_forward
            </span>
          </Link>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <ProviderTopology
          providers={providers}
          activeRequests={activeRequests}
          lastProvider={lastProvider}
          errorProvider={errorProvider}
        />
      </div>
    </Card>
  );
}
