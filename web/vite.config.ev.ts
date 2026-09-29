import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const canvasesDir = path.resolve(rootDir, "..");

/**
 * EV 资产组合独立站：不打包 Atlas/CRM。
 * 发布到 market-research gh-pages 的 /ev/ 路径，与 CRM 根站区隔。
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "cursor/canvas": path.resolve(rootDir, "src/shims/cursor-canvas.tsx"),
      react: path.resolve(rootDir, "node_modules/react"),
      "react-dom": path.resolve(rootDir, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(
        rootDir,
        "node_modules/react/jsx-runtime.js",
      ),
      "react/jsx-dev-runtime": path.resolve(
        rootDir,
        "node_modules/react/jsx-dev-runtime.js",
      ),
    },
  },
  server: {
    fs: {
      allow: [rootDir, canvasesDir],
    },
  },
  build: {
    outDir: "dist-ev",
    emptyOutDir: true,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      input: path.resolve(rootDir, "index-ev.html"),
    },
  },
});
