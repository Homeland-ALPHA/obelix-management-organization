// Prepares everything `wrangler deploy` / `wrangler dev` need: worker
// dependencies (hono) and the React app compiled into frontend/build.
// Wrangler runs this automatically via build.command in wrangler.jsonc.
//
// In CI (Workers Builds sets CI=true) or with --force it always rebuilds;
// locally it skips when frontend/build already exists so dev restarts stay
// fast. CRA is built with CI=false so lint warnings don't fail the build.
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const force =
  process.argv.includes("--force") ||
  (process.env.CI || "").toLowerCase() === "true";

const run = (cmd, cwd) => {
  console.log(`[build] ${cwd}> ${cmd}`);
  execSync(cmd, {
    stdio: "inherit",
    cwd: join(root, cwd),
    env: { ...process.env, CI: "false" },
  });
};

if (!existsSync(join(root, "worker", "node_modules"))) {
  run("npm ci", "worker");
}

if (!force && existsSync(join(root, "frontend", "build", "index.html"))) {
  console.log("[build] frontend/build present — skipping app build (node build.mjs --force to rebuild)");
  process.exit(0);
}

run("yarn install --frozen-lockfile", "frontend");
run("yarn build", "frontend");
