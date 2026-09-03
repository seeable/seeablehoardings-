import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**", ".open-next/**"],
    coverage: {
      provider: "v8",
      include: ["lib/**", "modules/**", "app/**"],
      exclude: ["**/*.d.ts", "**/*.config.*"],
    },
  },
});
