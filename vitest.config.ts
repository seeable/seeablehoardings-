import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // The real `server-only` package throws when `window` exists, which
      // jsdom always provides — stub it so tests that transitively import a
      // "server-only"-guarded module (lib/auth/session.ts, lib/api/facade.ts)
      // don't fail on an import guard that's irrelevant under Vitest.
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/mocks/server-only.ts",
      ),
    },
  },
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
