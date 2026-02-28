import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dest = join(__dirname, "public/uv");

if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

const candidates = [
  join(__dirname, "node_modules/@titaniumnetwork-dev/ultraviolet/dist"),
];

let src = null;
for (const c of candidates) {
  if (existsSync(c)) { src = c; break; }
}

if (!src) {
  // fallback: find any uv.bundle.js anywhere in the package
  console.error("dist not found, check package structure");
  process.exit(1);
}

console.log("Copying from:", src);
for (const f of readdirSync(src)) {
  if (statSync(join(src, f)).isFile()) {
    copyFileSync(join(src, f), join(dest, f));
    console.log("Copied:", f);
  }
}

console.log("public/uv contents:", readdirSync(dest));
