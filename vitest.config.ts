import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The regression suite ran with no config at all, which was fine while every
 * test was pure. The account-deletion integration test needs to import real
 * server code, and that code imports `@workspace/db` and uses `.js` specifiers
 * for TypeScript siblings (NodeNext style) — neither of which Vite resolves on
 * its own. These aliases are only for the test runner; the shipped builds have
 * their own resolution.
 */
const ROOT = __dirname;

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@workspace\/db$/, replacement: path.join(ROOT, "lib/db/src/index.ts") },
      { find: /^@workspace\/db\/schema$/, replacement: path.join(ROOT, "lib/db/src/schema/index.ts") },
      // `import "./logger.js"` → logger.ts. Relative specifiers only, so this
      // can never rewrite a real package import.
      { find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1.ts" },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    /**
     * Vitest's 5s default is too tight for this suite and made it FLAKY under
     * parallel load — three files failed one run and passed the next, all with
     * "Test timed out", none with a real assertion failure.
     *
     * That matters more here than in most projects: Railway runs `pnpm test` as
     * part of the deploy, so a suite that fails one run in five blocks a deploy
     * for no reason. This session already lost a deploy to a genuinely broken
     * test; losing one to a slow machine would be worse, because there is
     * nothing to fix.
     *
     * The timing tests that motivated this have themselves been replaced with
     * counts, which is the real answer — several tests here legitimately run
     * hundreds of full ephemeris computations, and a wall-clock ceiling was
     * measuring the CI box rather than the code either way. A genuine hang
     * still fails; it just takes 30 seconds to say so.
     */
    testTimeout: 30_000,
  },
});
