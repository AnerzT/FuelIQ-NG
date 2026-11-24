import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiPort = process.env.API_PORT || process.env.PORT || "3000";
const children = [];
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  const exitTimer = setTimeout(() => process.exit(exitCode), 1000);
  exitTimer.unref();
}

function start(label, script, args, env = process.env) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`[${label}] Could not start:`, error);
    stop(1);
  });
  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(`[${label}] Stopped (code ${code ?? "none"}, signal ${signal ?? "none"}).`);
      stop(code || 1);
    }
  });
}

const apiUrl = process.env.API_URL || `http://127.0.0.1:${apiPort}`;

start(
  "api",
  path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
  [path.join(root, "server", "index.ts")],
  { ...process.env, PORT: apiPort },
);
start(
  "vite",
  path.join(root, "node_modules", "vite", "bin", "vite.js"),
  ["--host", "127.0.0.1"],
  { ...process.env, API_URL: apiUrl },
);

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
