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
const outputDirectory = resolve(root, "src/generated");
const distDirectory = resolve(root, "dist");

// One entry per wasm crate. `crate` is the directory under crates/; `libName` is the cargo
// lib name (the produced <libName>.wasm); `outName` is the wasm-bindgen --out-name (glue +
// binary basename under src/generated/).
const crates = [
  { crate: "pipeline", libName: "pipeline", outName: "pipeline" },
  { crate: "color", libName: "color", outName: "color" },
];

const run = (command, args, options = {}) => {
  console.log(`[build-wasm] ${command} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit", ...options });
};

const hasCommand = (command) => {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [command], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

// src/generated/ is shared by every crate's glue, so clear it once up front.
rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });
if (!existsSync(distDirectory)) mkdirSync(distDirectory, { recursive: true });

const wasmOptAvailable = hasCommand("wasm-opt");
if (!wasmOptAvailable) {
  console.warn(
    "[build-wasm] wasm-opt not found on PATH - skipping size optimization. " +
      "Install binaryen for smaller output (e.g. `npm i -g binaryen` or your package manager).",
  );
}

for (const { crate, libName, outName } of crates) {
  const crateDirectory = resolve(root, "crates", crate);
  const wasmTarget = resolve(crateDirectory, `target/wasm32-unknown-unknown/release/${libName}.wasm`);

  run("cargo", ["build", "--release", "--target", "wasm32-unknown-unknown"], { cwd: crateDirectory });
  run("wasm-bindgen", ["--target", "web", "--out-dir", outputDirectory, "--out-name", outName, wasmTarget]);

  // Optimize for size (optional - wasm-bindgen output already works without it).
  const wasmBinaryPath = resolve(outputDirectory, `${outName}_bg.wasm`);
  if (wasmOptAvailable) {
    run("wasm-opt", ["-Oz", "--enable-bulk-memory", "-o", wasmBinaryPath, wasmBinaryPath]);
  }

  // Ensure the wasm sits next to the eventual bundle (dist/) so the glue's
  // `new URL('<outName>_bg.wasm', import.meta.url)` resolves at runtime.
  copyFileSync(wasmBinaryPath, resolve(distDirectory, `${outName}_bg.wasm`));
}

console.log("[build-wasm] done");
