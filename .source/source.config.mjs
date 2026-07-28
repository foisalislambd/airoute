// source.config.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineDocs, defineConfig } from "fumadocs-mdx/config";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var docsDir = path.resolve(__dirname, "../../docs");
var docs = defineDocs({
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
      "./ops/**/*.md"
    ]
  }
});
var source_config_default = defineConfig();
export {
  source_config_default as default,
  docs
};
