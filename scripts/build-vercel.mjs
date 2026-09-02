import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "artifacts", "asset-control");
const viteJs = path.join(appDir, "node_modules", "vite", "bin", "vite.js");

console.log("[build-vercel] root=", root);
console.log("[build-vercel] appDir=", appDir);
console.log("[build-vercel] vite=", viteJs, "exists=", existsSync(viteJs));

if (!existsSync(viteJs)) {
  console.error("[build-vercel] Vite is not installed. pnpm install must include devDependencies.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [viteJs, "build", "--config", "vite.config.ts"],
  {
    cwd: appDir,
    stdio: "inherit",
    env: process.env,
  },
);

if (result.error) {
  console.error("[build-vercel]", result.error);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
