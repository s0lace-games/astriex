// This runs as postinstall on Vercel - copies UV dist files to public/uv
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const dest = join(__dirname, "public/uv");
mkdirSync(dest, { recursive: true });

// Use require.resolve to find the package regardless of install location
let pkgPath;
try {
  pkgPath = dirname(require.resolve("@titaniumnetwork-dev/ultraviolet/package.json"));
} catch (e) {
  console.error("ERROR: Could not find @titaniumnetwork-dev/ultraviolet:", e.message);
  process.exit(1);
}

console.log("Package found at:", pkgPath);

// Find the dist directory
const distPath = join(pkgPath, "dist");
if (!existsSync(distPath)) {
  console.log("No dist/ folder. Package contents:", readdirSync(pkgPath));
  process.exit(1);
}

console.log("Dist contents:", readdirSync(distPath));

for (const file of readdirSync(distPath)) {
  const src = join(distPath, file);
  if (statSync(src).isFile() && file.endsWith(".js")) {
    copyFileSync(src, join(dest, file));
    console.log("Copied:", file);
  }
}

console.log("public/uv now contains:", readdirSync(dest));
