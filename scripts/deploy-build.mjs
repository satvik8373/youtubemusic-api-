import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const musicAppDir = resolve(rootDir, "artifacts/music-app");

// The primary build output
const sourceCandidates = [
  resolve(rootDir, "public"),
  resolve(musicAppDir, "dist/public"),
  resolve(musicAppDir, "dist"),
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
  if (dest === srcDir) continue;
  mkdirSync(dest, { recursive: true });
  cpSync(srcDir, dest, { recursive: true });
  console.log(`[Build Sync] Synced build to: ${dest}`);
}

console.log("[Build Sync] Complete! Verified output in root public:", readdirSync(resolve(rootDir, "public")));
