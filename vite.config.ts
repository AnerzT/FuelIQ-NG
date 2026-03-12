import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // This tells Vite where your index.html is
  root: path.resolve(__dirname, "client"), 
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  build: {
    // This tells Vite to put the result back in the root /dist
    outDir: path.resolve(__dirname, "dist"), 
    emptyOutDir: true,
  },
});
