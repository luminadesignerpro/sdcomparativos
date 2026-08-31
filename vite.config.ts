import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
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
