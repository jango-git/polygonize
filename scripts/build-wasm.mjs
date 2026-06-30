#!/usr/bin/env node
// Builds the Rust wasm crates, generates the wasm-bindgen glue, and optimizes the
// binaries. Output lands in src/generated/ (gitignored); rollup bundles the glue and each
// .wasm is copied next to the bundle at build time.
//
// Requires on PATH: cargo, wasm32-unknown-unknown target, wasm-bindgen, wasm-opt.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "src/generated");
const dist = resolve(root, "dist");

// One entry per wasm crate. `crate` is the directory under crates/; `lib` is the cargo
// lib name (the produced <lib>.wasm); `out` is the wasm-bindgen --out-name (glue + binary
// basename under src/generated/).
const crates = [
  { crate: "pipeline", lib: "pipeline", out: "pipeline" },
  { crate: "color", lib: "color", out: "color" },
];

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

// src/generated/ is shared by every crate's glue, so clear it once up front.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

const wasmOptAvailable = hasCommand("wasm-opt");
if (!wasmOptAvailable) {
  console.warn(
    "[build-wasm] wasm-opt not found on PATH - skipping size optimization. " +
      "Install binaryen for smaller output (e.g. `npm i -g binaryen` or your package manager).",
  );
}

for (const { crate, lib, out } of crates) {
  const crateDir = resolve(root, "crates", crate);
  const wasmTarget = resolve(crateDir, `target/wasm32-unknown-unknown/release/${lib}.wasm`);

  run("cargo", ["build", "--release", "--target", "wasm32-unknown-unknown"], { cwd: crateDir });
  run("wasm-bindgen", ["--target", "web", "--out-dir", outDir, "--out-name", out, wasmTarget]);

  // Optimize for size (optional - wasm-bindgen output already works without it).
  const bg = resolve(outDir, `${out}_bg.wasm`);
  if (wasmOptAvailable) {
    run("wasm-opt", ["-Oz", "--enable-bulk-memory", "-o", bg, bg]);
  }

  // Ensure the wasm sits next to the eventual bundle (dist/) so the glue's
  // `new URL('<out>_bg.wasm', import.meta.url)` resolves at runtime.
  copyFileSync(bg, resolve(dist, `${out}_bg.wasm`));
}

console.log("[build-wasm] done");
