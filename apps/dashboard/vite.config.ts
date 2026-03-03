import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "dashboard",
      remotes: {
        promptManager: "http://localhost:5174/remoteEntry.js",
        guardrail: "http://localhost:5175/remoteEntry.js",
        userManager: "http://localhost:5176/remoteEntry.js",
        usagesData: "http://localhost:5177/remoteEntry.js",
      },
      shared: {
        react: { singleton: true, requiredVersion: "^18.3.1" },
        "react-dom": { singleton: true, requiredVersion: "^18.3.1" },
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
    cors: true,
  },
  preview: {
    port: 5173,
    cors: true,
  },
  build: {
    target: "esnext",
  },
});
