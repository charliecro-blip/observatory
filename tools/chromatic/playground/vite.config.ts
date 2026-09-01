// The playground borrows the api-server's natal engine for live chart
// calculation. Two aliases make that possible without a node_modules of our
// own: the api-server modules import each other with `.js` specifiers that
// must resolve back to `.ts` (same trick as vitest.tools.config.ts), and the
// bare `astronomy-engine` import resolves into the root pnpm store, where it
// lives as a dependency of @workspace/api-server.

import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const STORE = path.join(ROOT, "node_modules/.pnpm");

const aeDir = fs.readdirSync(STORE).filter((d) => d.startsWith("astronomy-engine@")).sort().pop();
if (!aeDir) throw new Error("astronomy-engine not found in the pnpm store — run pnpm install at the repo root.");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1.ts" },
      { find: "astronomy-engine", replacement: path.join(STORE, aeDir, "node_modules/astronomy-engine") },
    ],
  },
  server: { fs: { allow: [ROOT] } },
});
