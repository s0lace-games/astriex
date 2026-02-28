import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync, createWriteStream } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dest = join(__dirname, "public/uv");
mkdirSync(dest, { recursive: true });

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return follow(res.headers.location);
        }
        const file = createWriteStream(outPath);
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
        file.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

function tryNodeModules() {
  const bases = [
    join(__dirname, "node_modules/@titaniumnetwork-dev/ultraviolet/dist"),
    join(__dirname, "node_modules/@titaniumnetwork-dev/ultraviolet"),
  ];
  for (const base of bases) {
    if (!existsSync(base)) continue;
    const files = readdirSync(base);
    if (files.includes("uv.bundle.js")) {
      console.log("Found UV dist at:", base);
      for (const f of files) {
        const src = join(base, f);
        if (statSync(src).isFile() && f.endsWith(".js")) {
          copyFileSync(src, join(dest, f));
          console.log("Copied:", f);
        }
      }
      return true;
    }
  }
  return false;
}

async function main() {
  if (!tryNodeModules()) {
    console.log("Falling back to downloading from unpkg...");
    const base = "https://unpkg.com/@titaniumnetwork-dev/ultraviolet@1.0.10/dist/";
    for (const f of ["uv.bundle.js", "uv.handler.js", "uv.sw.js"]) {
      console.log("Downloading:", f);
      await download(base + f, join(dest, f));
      console.log("Done:", f);
    }
  }
  console.log("public/uv contents:", readdirSync(dest));
}

main().catch((e) => { console.error(e); process.exit(1); });
