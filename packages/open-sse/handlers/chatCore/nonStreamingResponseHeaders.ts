/**
 * chatCore non-streaming success response headers (Quality Gate v2 / Fase 9 — chatCore god-file
 * decomposition, #3501).
 *
 * Extracted from handleChatCore's non-streaming success path: build the response header map for a
 * cache-MISS JSON response — the static Content-Type + cache marker, the AIRoute meta headers
 * (provider/model/latency/usage/cost/request-id), and the optional compression header. Pure builder
 * (returns a fresh map; only mutates the map it owns). Behaviour is byte-identical to the previous
 * inline block, including `latencyMs: now - startTime`.
 */
import { AIROUTE_RESPONSE_HEADERS } from "@/shared/constants/headers";
import { attachAIRouteMetaHeaders as defaultAttachMeta } from "@/domain/airouteResponseMeta";

export function buildNonStreamingResponseHeaders(
  args: {
    provider: string | null | undefined;
    model: string | null | undefined;
    startTime: number;
    responseUsage: unknown;
    estimatedCost: number;
    requestId: unknown;
    compressionResponseMeta?: string | null | undefined;
    comboStrategy?: string | null | undefined;
  },
  deps: { attachAIRouteMetaHeaders: typeof defaultAttachMeta; now: () => number } = {
    attachAIRouteMetaHeaders: defaultAttachMeta,
    now: Date.now,
  }
): Record<string, string> {
  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    [AIROUTE_RESPONSE_HEADERS.cache]: "MISS",
  };
  deps.attachAIRouteMetaHeaders(responseHeaders, {
    provider: args.provider,
    model: args.model,
    cacheHit: false,
    latencyMs: deps.now() - args.startTime,
    usage: args.responseUsage,
    costUsd: args.estimatedCost,
    requestId: args.requestId,
    strategy: args.comboStrategy ?? "single",
  });
  if (args.compressionResponseMeta) {
    responseHeaders[AIROUTE_RESPONSE_HEADERS.compression] = args.compressionResponseMeta;
  }
  return responseHeaders;
}
