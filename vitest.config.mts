import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // `server-only` throws outside the React server bundle; tests run plain Node.
      "server-only": path.resolve(root, "tests/helpers/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // scrypt at OWASP strength takes a few hundred ms per hash.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
