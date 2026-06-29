#!/usr/bin/env node
// Builds the Rust pipeline crate to wasm, generates the wasm-bindgen glue, and
// optimizes the binary. Output lands in src/generated/ (gitignored); rollup bundles
// the glue and the .wasm is copied next to the bundle at build time.
//
// Requires on PATH: cargo, wasm32-unknown-unknown target, wasm-bindgen, wasm-opt.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const crate = resolve(root, "crates/pipeline");
const outDir = resolve(root, "src/generated");
const wasmTarget = resolve(crate, "target/wasm32-unknown-unknown/release/pipeline.wasm");

const run = (cmd, args, opts = {}) => {
  console.log(`[build-wasm] ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
};

const hasCommand = (cmd) => {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [cmd], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

run("cargo", ["build", "--release", "--target", "wasm32-unknown-unknown"], {
  cwd: crate,
});

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
run("wasm-bindgen", ["--target", "web", "--out-dir", outDir, "--out-name", "pipeline", wasmTarget]);

// 3. Optimize for size (optional - wasm-bindgen output already works without it).
const bg = resolve(outDir, "pipeline_bg.wasm");
if (hasCommand("wasm-opt")) {
  run("wasm-opt", ["-Oz", "--enable-bulk-memory", "-o", bg, bg]);
} else {
  console.warn(
    "[build-wasm] wasm-opt not found on PATH - skipping size optimization. " +
      "Install binaryen for smaller output (e.g. `npm i -g binaryen` or your package manager).",
  );
}

// 4. Ensure the wasm sits next to the eventual bundle (dist/) so the glue's
//    `new URL('pipeline_bg.wasm', import.meta.url)` resolves at runtime.
const dist = resolve(root, "dist");
if (!existsSync(dist)) mkdirSync(dist, { recursive: true });
copyFileSync(bg, resolve(dist, "pipeline_bg.wasm"));

console.log("[build-wasm] done");
