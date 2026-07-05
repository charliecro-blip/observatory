import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  // Static source assets (favicon, manifest, sw.js, …) live in ./static and are
  // COPIED into the build output. This must be separate from outDir, otherwise
  // emptyOutDir wipes them on every build (they used to sit in ./public).
  publicDir: path.resolve(import.meta.dirname, "static"),
  build: {
    outDir: path.resolve(import.meta.dirname, "public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split the stable framework code from app code so app changes don't
        // re-download React, and the main chunk stays under the 500KB warning.
        manualChunks: {
          vendor: ["react", "react-dom", "@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    port: 5174,
    host: "0.0.0.0",
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  preview: {
    port: 5174,
    host: "0.0.0.0",
  },
});
