import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const GH_PAGES_BASE = "/kd-tree-citymap/";

const rootDir = dirname(fileURLToPath(import.meta.url));
const viewerDir = resolve(rootDir, "viewer");

const BIN_FILES = ["ma_base.kdtree.bin", "ma_base.textindex.bin"];

function rootBinaries(): Plugin {
  return {
    name: "chronocosmos-root-binaries",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split("?")[0] ?? "";
        const name = BIN_FILES.find((f) => pathname.endsWith(`/${f}`));
        if (!name) return next();
        res.setHeader("Content-Type", "application/octet-stream");
        res.end(readFileSync(resolve(rootDir, name)));
      });
    },
    generateBundle() {
      for (const name of BIN_FILES) {
        this.emitFile({
          type: "asset",
          fileName: name,
          source: readFileSync(resolve(rootDir, name)),
        });
      }
    },
  };
}

export default defineConfig({
  root: viewerDir,
  base: GH_PAGES_BASE,
  plugins: [rootBinaries()],
  build: {
    outDir: resolve(rootDir, "dist"),
    emptyOutDir: true,
    sourcemap: true,
  },
});
