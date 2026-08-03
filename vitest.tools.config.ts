import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Config for the opt-in diagnostic harnesses in tools/.
 *
 * They are deliberately NOT in tests/: the convergence calibration run takes
 * ~3 minutes, and Railway executes `pnpm test` before every build. Keeping
 * them behind their own config means a slow diagnostic can never hold up a
 * deploy.
 *
 *     npx vitest run --config vitest.tools.config.ts
 *
 * Written standalone rather than via mergeConfig: mergeConfig CONCATENATES
 * `include`, so extending the base config ran the whole 404-test suite
 * alongside the harness instead of the harness alone.
 */
const ROOT = __dirname;

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@workspace\/db$/, replacement: path.join(ROOT, "lib/db/src/index.ts") },
      { find: /^@workspace\/db\/schema$/, replacement: path.join(ROOT, "lib/db/src/schema/index.ts") },
      { find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1.ts" },
    ],
  },
  test: { include: ["tools/**/*.test.ts"], testTimeout: 900_000 },
});
