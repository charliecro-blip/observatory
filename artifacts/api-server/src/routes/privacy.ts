import type { Request, Response } from "express";
import fs from "fs";
import path from "path";

/**
 * Serves PRIVACY-POLICY-DRAFT.md as a plain HTML page at /privacy — a public
 * URL for beta testers and Google OAuth consent, without pulling in a
 * markdown dependency or duplicating the policy text into a second source.
 * The .md file (repo root: artifacts/tides/) stays the one place to edit it.
 */
function inline(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function mdToHtml(md: string): string {
  return md
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      if (block.startsWith("## ")) return `<h2>${inline(block.slice(3))}</h2>`;
      if (block.startsWith("# ")) return `<h1>${inline(block.slice(2))}</h1>`;
      if (block.startsWith("- ")) {
        const items = block
          .split(/\n(?=- )/)
          .map((item) => item.replace(/^- /, "").replace(/\n\s+/g, " "));
        return `<ul>${items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`;
      }
      return `<p>${inline(block.replace(/\n/g, " "))}</p>`;
    })
    .join("\n");
}

export function privacyHandler(_req: Request, res: Response) {
  const mdPath = path.join(process.cwd(), "artifacts/tides/PRIVACY-POLICY-DRAFT.md");
  let body: string;
  try {
    body = mdToHtml(fs.readFileSync(mdPath, "utf-8"));
  } catch {
    res.status(404).send("Not found");
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — Compass</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    max-width: 640px; margin: 0 auto; padding: 48px 24px 80px; line-height: 1.6;
    color: #2a2622; background: #fdfcfa; }
  h1 { font-size: 26px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 32px; color: #4a453e; }
  a { color: #2a5a80; }
  ul { padding-left: 20px; }
  li { margin-bottom: 8px; }
  p { margin: 12px 0; }
</style>
</head>
<body>
${body}
</body>
</html>`);
}
