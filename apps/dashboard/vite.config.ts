import path from "node:path";
import { fileURLToPath } from "node:url";
import federation from "@originjs/vite-plugin-federation";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "dashboard",
      remotes: {
        // Override via VITE_REMOTE_* for Docker/nginx same-origin serving.
        // Vite emits remoteEntry under /assets/ (not the site root).
        promptManager:
          process.env.VITE_REMOTE_PROMPT_MANAGER ?? "http://localhost:5174/assets/remoteEntry.js",
        guardrail:
          process.env.VITE_REMOTE_GUARDRAIL ?? "http://localhost:5175/assets/remoteEntry.js",
        userManager:
          process.env.VITE_REMOTE_USER_MANAGER ?? "http://localhost:5176/assets/remoteEntry.js",
        usagesData:
          process.env.VITE_REMOTE_USAGES_DATA ?? "http://localhost:5177/assets/remoteEntry.js",
      },
      shared: {
        react: { singleton: true, requiredVersion: "^19.0.0" },
        "react-dom": { singleton: true, requiredVersion: "^19.0.0" },
        "@tanstack/react-query": { singleton: true },
        "@repo/api-client": { singleton: true },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
    cors: true,
  },
  build: {
    target: "esnext",
    modulePreload: false,
  },
});
