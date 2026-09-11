import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

const buildTimestamp = Date.now().toString();

export default defineConfig(({ mode }) => ({
  base: "/",
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    {
      name: "version-generator",
      buildStart() {
        try {
          const versionInfo = JSON.stringify(
            { version: buildTimestamp, buildDate: new Date().toISOString() },
            null,
            2
          );
          const publicDir = path.resolve(__dirname, "public");
          if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
          }
          fs.writeFileSync(path.resolve(publicDir, "version.json"), versionInfo);
        } catch (e) {
          console.warn("Could not write version.json:", e);
        }
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify(
            { version: buildTimestamp, buildDate: new Date().toISOString() },
            null,
            2
          ),
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Garante instância única — CRÍTICO para @react-three/fiber
    dedupe: ["react", "react-dom", "three"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "three", "@react-three/fiber", "@react-three/drei"],
  },
  build: {
    target: "es2015",
    // SEM manualChunks — o chunking manual causava dependências circulares entre chunks
    // resultando em React undefined (useLayoutEffect, forwardRef, etc.)
    // Vite gera chunks automaticamente de forma segura
    chunkSizeWarningLimit: 5000,
  },
}));
