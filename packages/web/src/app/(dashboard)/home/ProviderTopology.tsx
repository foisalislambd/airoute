"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Handle, Position, type Node, type Edge, type NodeTypes } from "@xyflow/react";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { FlowCanvas } from "@/shared/components/flow/FlowCanvas";
import { StatusDot } from "@/shared/components/flow/StatusDot";
import { edgeStyle, FLOW_EDGE_COLORS } from "@/shared/components/flow/edgeStyles";
import { getFallbackProviderColor } from "@/shared/utils/providerFallbackColor";
import { resolveTopologyNodeLabel } from "./topologyLabel";

// Rings: [capacity, rx, ry]. Each successive ring fits ~6 more nodes.
const RINGS: [number, number, number][] = [
  [8, 210, 132],
  [14, 370, 233],
  [20, 530, 334],
  [26, 690, 435],
  [32, 850, 536],
  [38, 1010, 637],
];

type ProviderConfig = { color?: string; name?: string; textIcon?: string };

function getProviderConfig(providerId: string): ProviderConfig {
  // Predefined providers keep their registry color/name untouched. Anything else (custom
  // openai-compatible-*/anthropic-compatible-* provider_nodes) gets a deterministic,
  // per-id fallback color instead of one shared gray — see #8328.
  return (
    (AI_PROVIDERS as Record<string, ProviderConfig>)[providerId] || {
      color: getFallbackProviderColor(providerId),
      name: providerId,
    }
  );
}

type ProviderNodeData = {
  label: string;
  color: string;
  providerId: string;
  active: boolean;
  error: boolean;
  /** Connection-health base state: a healthy connection with no in-flight traffic. */
  healthy: boolean;
  /** Most recently routed provider. Orthogonal to health — it can be last *and* healthy. */
  last: boolean;
};

function ProviderNode({ data }: { data: ProviderNodeData }) {
  const { label, color, providerId, active, error, healthy, last } = data;
  const GREEN = FLOW_EDGE_COLORS.active;
  const RED = FLOW_EDGE_COLORS.error;
  const AMBER = FLOW_EDGE_COLORS.last;
  // "Last routed" is a traffic annotation, not a health state: the border keeps saying
  // whether the connection is up, and only the dot turns amber to mark recency.
  const dotColor = active ? color : last ? AMBER : GREEN;

  return (
    <div
      className="flex items-center gap-2 rounded-xl border-2 bg-white px-2.5 py-1.5 transition-all duration-300 dark:bg-gray-900"
      style={{
        borderColor: error ? RED : active ? color : healthy ? GREEN : "var(--color-border)",
        boxShadow: error
          ? `0 0 12px ${RED}30`
          : active
            ? `0 0 12px ${color}30`
            : healthy
              ? `0 0 10px ${GREEN}20`
              : "none",
        minWidth: "136px",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-transparent !border-0 !w-0 !h-0"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        className="!bg-transparent !border-0 !w-0 !h-0"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-transparent !border-0 !w-0 !h-0"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="!bg-transparent !border-0 !w-0 !h-0"
      />

      <div
        className="size-6 rounded flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <ProviderIcon providerId={providerId} size={16} type="color" />
      </div>

      <span
        className="text-xs font-medium truncate flex-1"
        style={{
          color: active ? color : error ? RED : healthy ? GREEN : "var(--color-text-main)",
        }}
      >
        {label}
      </span>

      {(active || error || healthy || last) && (
        <StatusDot color={dotColor} error={error} pulse={active || error} />
      )}
    </div>
  );
}

type RouterNodeData = { activeCount: number };

function RouterNode({ data }: { data: RouterNodeData }) {
  return (
    <div className="flex min-w-[148px] items-center justify-center gap-2 rounded-xl border-2 border-brand-500 bg-white px-5 py-3 shadow-lg shadow-brand-500/15 dark:bg-gray-900">
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="!bg-transparent !border-0 !w-0 !h-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-transparent !border-0 !w-0 !h-0"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!bg-transparent !border-0 !w-0 !h-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-transparent !border-0 !w-0 !h-0"
      />

      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          route
        </span>
      </div>
      <span className="text-sm font-bold text-brand-600 dark:text-brand-300">AIRoute</span>
      {data.activeCount > 0 && (
        <span className="ml-0.5 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {data.activeCount}
        </span>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  provider: ProviderNode as any,
  router: RouterNode as any,
};

type ProviderHealth = "active" | "error" | "idle";
type ProviderEntry = { id?: string; provider: string; name?: string; status?: ProviderHealth };

function getHandles(angle: number, cx: number): { sourceHandle: string; targetHandle: string } {
  const rel = (((angle + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (rel < Math.PI / 4 || rel > (7 * Math.PI) / 4)
    return { sourceHandle: "top", targetHandle: "bottom" };
  if (rel > (3 * Math.PI) / 4 && rel < (5 * Math.PI) / 4)
    return { sourceHandle: "bottom", targetHandle: "top" };
  return cx > 0
    ? { sourceHandle: "right", targetHandle: "left" }
    : { sourceHandle: "left", targetHandle: "right" };
}

function buildLayout(
  providers: ProviderEntry[],
  activeSet: Set<string>,
  lastSet: Set<string>,
  errorSet: Set<string>
): { nodes: Node[]; edges: Edge[] } {
  const nodeW = 156;
  const nodeH = 28;
  const routerW = 148;
  const routerH = 44;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  nodes.push({
    id: "router",
    type: "router",
    position: { x: -routerW / 2, y: -routerH / 2 },
    data: { activeCount: activeSet.size },
    draggable: false,
  });

  if (providers.length === 0) return { nodes, edges };

  // Sort: active → error → last-used → healthy(connected) → rest (alpha within groups)
  const sorted = [...providers].sort((a, b) => {
    const rank = (p: ProviderEntry) => {
      const id = p.provider.toLowerCase();
      if (activeSet.has(id)) return 0;
      if (errorSet.has(id) || p.status === "error") return 1;
      if (lastSet.has(id)) return 2;
      if (p.status === "active") return 3;
      return 4;
    };
    const d = rank(a) - rank(b);
    return d !== 0
      ? d
      : a.provider.toLowerCase().localeCompare(b.provider.toLowerCase()); // ASCII kasıtlı
  });

  let provIdx = 0;
  for (let ri = 0; ri < RINGS.length && provIdx < sorted.length; ri++) {
    const [cap, rx, ry] = RINGS[ri];
    const count = Math.min(cap, sorted.length - provIdx);

    for (let i = 0; i < count; i++) {
      const p = sorted[provIdx++];
      const pid = p.provider.toLowerCase();
      const active = activeSet.has(pid);
      // Traffic signals (live/recent request) take precedence; connection health is the
      // base state shown when a provider has no in-flight or recent traffic, so the map
      // still reflects "what is connected" at rest instead of going blank after a restart.
      const trafficError = !active && errorSet.has(pid);
      const last = !active && !trafficError && lastSet.has(pid);
      // Health is orthogonal to recency: having just served a request does not make a
      // connection any less connected. `last` used to suppress `healthy`/`healthError`,
      // and because the node had no `last` visual it fell all the way through to the idle
      // grey — so the provider you had just used rendered *less* connected than an idle
      // peer, while its edge was amber. Health drives the border, `last` only the dot.
      const healthError = !active && !trafficError && p.status === "error";
      const healthy = !active && !trafficError && !healthError && p.status === "active";
      const error = trafficError || healthError;
      const config = getProviderConfig(p.provider);
      const nodeId = `provider-${p.provider}`;

      const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
      const cx = rx * Math.cos(angle);
      const cy = ry * Math.sin(angle);
      const { sourceHandle, targetHandle } = getHandles(angle, cx);

      nodes.push({
        id: nodeId,
        type: "provider",
        position: { x: cx - nodeW / 2, y: cy - nodeH / 2 },
        data: {
          label: resolveTopologyNodeLabel(p.name, config.name, p.provider),
          color: config.color || "#6b7280",
          providerId: p.provider,
          active,
          error,
          healthy,
          last,
        } satisfies ProviderNodeData,
        draggable: false,
      });

      edges.push({
        id: `e-${nodeId}`,
        source: "router",
        sourceHandle,
        target: nodeId,
        targetHandle,
        animated: active,
        style: edgeStyle(active, last, error, healthy),
      });
    }
  }

  return { nodes, edges };
}

type Props = {
  providers?: ProviderEntry[];
  activeRequests?: Array<{ provider?: string; model?: string }>;
  lastProvider?: string;
  errorProvider?: string;
};

export default function ProviderTopology({
  providers = [],
  activeRequests = [],
  lastProvider = "",
  errorProvider = "",
}: Props) {
  const t = useTranslations("common");
  const activeKey = useMemo(
    () =>
      activeRequests
        .map((r) => r.provider?.toLowerCase())
        .filter(Boolean)
        .sort()
        .join(","),
    [activeRequests]
  );
  const lastKey = lastProvider.toLowerCase();
  const errorKey = errorProvider.toLowerCase();

  const activeSet = useMemo(
    () => new Set<string>(activeKey ? activeKey.split(",") : []),
    [activeKey]
  );
  const lastSet = useMemo(() => new Set<string>(lastKey ? [lastKey] : []), [lastKey]);
  const errorSet = useMemo(() => new Set<string>(errorKey ? [errorKey] : []), [errorKey]);

  const { nodes, edges } = useMemo(
    () => buildLayout(providers, activeSet, lastSet, errorSet),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providers, activeSet, lastKey, errorKey]
  );

  const providersKey = useMemo(
    () =>
      providers
        .map((p) => p.provider)
        .sort()
        .join(","),
    [providers]
  );

  const containerClass =
    "h-[280px] w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50 sm:h-[400px]";

  if (providers.length === 0) {
    return (
      <div className={`${containerClass} flex flex-col items-center justify-center gap-3 px-6 text-center`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
          <span className="material-symbols-outlined text-[28px] text-brand-500" aria-hidden="true">
            hub
          </span>
        </div>
        <div className="max-w-xs space-y-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {t("providerTopologyEmpty")}
          </p>
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Connect a provider to see live routing topology on this map.
          </p>
        </div>
        <a
          href="/dashboard/providers"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-brand-500/25 transition hover:bg-brand-600"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            add
          </span>
          Add provider
        </a>
      </div>
    );
  }

  return (
    <FlowCanvas
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitKey={providersKey}
      className={containerClass}
    />
  );
}
