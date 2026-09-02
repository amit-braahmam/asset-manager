import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "artifacts", "asset-control");
const apiDir = path.join(root, "artifacts", "api-server");
const viteJs = path.join(appDir, "node_modules", "vite", "bin", "vite.js");
const apiBuild = path.join(apiDir, "build.mjs");

function run(label, file, args, cwd) {
  console.log(`[build-vercel] ${label}`);
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error("[build-vercel]", result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
}

console.log("[build-vercel] root=", root);
console.log("[build-vercel] appDir=", appDir);
console.log("[build-vercel] vite=", viteJs, "exists=", existsSync(viteJs));

if (!existsSync(viteJs)) {
  console.error("[build-vercel] Vite is not installed. pnpm install must include devDependencies.");
  process.exit(1);
}

if (!existsSync(apiBuild)) {
  console.error("[build-vercel] API build script missing:", apiBuild);
  process.exit(1);
}

run("bundle API for Vercel", apiBuild, ["--vercel"], apiDir);
run("vite build", viteJs, ["build", "--config", "vite.config.ts"], appDir);

const bundledApi = path.join(apiDir, "dist", "vercel-app.mjs");
if (!existsSync(bundledApi)) {
  console.error("[build-vercel] API bundle was not written:", bundledApi);
  process.exit(1);
}

console.log("[build-vercel] API bundle=", bundledApi);
