/**
 * Node-only instrumentation chunk for Next.js.
 * Explicit named re-exports (avoid `export *` CJS interop holes under tsx).
 */
export {
  ensureDbReadyForBoot,
  normalizeBootError,
  registerNodejs,
  renameProcessTitle,
  scanComboModelNameCollisionsAtBoot,
  warmModelCatalogCache,
} from "../../core/instrumentation-node.ts";
