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
  },
});
