import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(process.cwd(), "client"),
  server: {
    proxy: {
      '/api': process.env.API_URL || 'http://127.0.0.1:3000',
    },
  },
  build: {
    outDir: path.resolve(process.cwd(), "dist/client"),
    emptyOutDir: true,
    minify: "esbuild",
    cssMinify: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "client/src"),
      "@shared": path.resolve(process.cwd(), "shared"),
    },
  },
});
