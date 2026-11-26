// Runs after `tsc -p tsconfig.esm.json`.
//
// The browser (ESM) build must not contain the full Lucide icon set, so its
// lucide-fallback.js is replaced with the lazy, per-icon version compiled from
// src/render/widgets/lucide-fallback.esm.tsx. The CommonJS build in dist/
// keeps the synchronous full-set version for Node servers.
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "dist-esm", "render", "widgets");
const from = path.join(dir, "lucide-fallback.esm.js");
const to = path.join(dir, "lucide-fallback.js");

if (!fs.existsSync(from)) {
  console.error(`postbuild-esm: ${from} is missing — did the ESM build run?`);
  process.exit(1);
}
fs.copyFileSync(from, to);
fs.unlinkSync(from);

if (/from\s+["']lucide-react["']\s*;?\s*$/m.test(fs.readFileSync(to, "utf8")) &&
    /import\s+\*\s+as/.test(fs.readFileSync(to, "utf8"))) {
  console.error("postbuild-esm: lucide-fallback.js still imports the whole set");
  process.exit(1);
}
console.log("postbuild-esm: dist-esm uses lazy Lucide icons");
