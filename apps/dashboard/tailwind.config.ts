import aiplanePreset from "@repo/ui/tailwind.config";
import type { Config } from "tailwindcss";

export default {
  presets: [aiplanePreset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    // Federated remotes: generate utilities for remote class names in the host bundle
    // so remotes stay styled without shipping a second global CSS (see #107 / #108).
    "../prompt-manager/src/**/*.{ts,tsx}",
    "../guardrail/src/**/*.{ts,tsx}",
    "../user-manager/src/**/*.{ts,tsx}",
    "../usages-data/src/**/*.{ts,tsx}",
  ],
} satisfies Config;
