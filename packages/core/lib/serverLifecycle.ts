export type ServerLifecyclePhase = "starting" | "ready" | "stopping";

declare global {
  var __airouteServerLifecycle: ServerLifecyclePhase | undefined;
}

export function getServerLifecyclePhase(): ServerLifecyclePhase {
  return globalThis.__airouteServerLifecycle ?? "starting";
}

export function markServerStarting(): void {
  globalThis.__airouteServerLifecycle = "starting";
}

export function markServerReady(): void {
  if (getServerLifecyclePhase() !== "stopping") {
    globalThis.__airouteServerLifecycle = "ready";
  }
}

export function markServerStopping(): void {
  globalThis.__airouteServerLifecycle = "stopping";
}
