import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineDocs, defineConfig } from "fumadocs-mdx/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Docs content lives at the monorepo root — not under packages/web. */
const docsDir = path.resolve(__dirname, "../../docs");

export const docs = defineDocs({
  dir: docsDir,
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
