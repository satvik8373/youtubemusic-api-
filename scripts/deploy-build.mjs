import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const musicAppDir = resolve(rootDir, "artifacts/music-app");

// The primary build output
const sourceCandidates = [
  resolve(rootDir, "dist"),
  resolve(rootDir, "public"),
  resolve(musicAppDir, "dist"),
  resolve(musicAppDir, "dist/public"),
  resolve(musicAppDir, "public"),
];

const srcDir = sourceCandidates.find((d) => existsSync(resolve(d, "index.html")));

if (!srcDir) {
  console.error("No index.html found in any source candidate:", sourceCandidates);
  process.exit(1);
}

console.log(`[Build Sync] Found build output in: ${srcDir}`);

const destinations = [
  resolve(rootDir, "public"),
  resolve(rootDir, "dist"),
  resolve(musicAppDir, "public"),
  resolve(musicAppDir, "dist"),
  resolve(musicAppDir, "dist/public"),
];

for (const dest of destinations) {
  if (dest !== srcDir) {
    mkdirSync(dest, { recursive: true });
    cpSync(srcDir, dest, { recursive: true });
    console.log(`[Build Sync] Synced build to: ${dest}`);
  }
  const indexJs = resolve(dest, "index.js");
  if (!existsSync(indexJs)) {
    writeFileSync(indexJs, "// Generated build artifact entrypoint\nexport default {};\n");
  }
}

console.log("[Build Sync] Complete! Verified output in root dist:", readdirSync(resolve(rootDir, "dist")));

