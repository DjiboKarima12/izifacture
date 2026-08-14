import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Aligné sur `paths` dans tsconfig.json. Déclaré à la main plutôt que via
    // vite-tsconfig-paths, qui est ESM-only et ne se charge pas depuis une
    // config TypeScript compilée en CJS.
    alias: {
      "@": path.resolve(process.cwd()),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
