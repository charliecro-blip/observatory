---
name: Scripts package CWD quirk
description: When pnpm runs a script in scripts/, process.cwd() resolves to scripts/, not the workspace root. Use import.meta.url to find the workspace root.
---

When a script in `scripts/src/` calls `resolve(process.cwd(), "some/path")`, it resolves relative to `/home/runner/workspace/scripts/`, not the workspace root.

**Fix:**
```typescript
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = resolve(__dirname, "../.."); // scripts/src → scripts → root
```

**Why:** pnpm `--filter @workspace/scripts run <script>` changes directory to the package before executing, so `process.cwd()` is unreliable for locating sibling workspace directories.

**How to apply:** Any script in `scripts/src/` that needs to reference files outside `scripts/` (e.g. `knowledge/`, `lib/`, `artifacts/`) must use the `import.meta.url` pattern above.
