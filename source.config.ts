import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineDocs, defineConfig } from "fumadocs-mdx/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Root fumadocs config (CLI / ad-hoc generation).
 * The Next app uses packages/web/source.config.ts and emits into this same
 * monorepo-root `.source/` directory via createMDX({ outDir }).
 */
export const docs = defineDocs({
  dir: path.resolve(__dirname, "docs"),
  docs: {
    files: [
      "./architecture/**/*.md",
      "./guides/**/*.md",
      "./reference/**/*.md",
      "./frameworks/**/*.md",
      "./routing/**/*.md",
      "./security/**/*.md",
      "./compression/**/*.md",
      "./ops/**/*.md",
    ],
  },
});

export default defineConfig();
