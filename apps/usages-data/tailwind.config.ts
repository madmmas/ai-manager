import aiplanePreset from "@repo/ui/tailwind.config";
import type { Config } from "tailwindcss";

export default {
  presets: [aiplanePreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
} satisfies Config;
