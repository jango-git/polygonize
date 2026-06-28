#!/usr/bin/env bash
# Provisions the wasm build toolchain for the polygonize devcontainer:
#   - binaryen (wasm-opt)        — size optimization
#   - rustup + wasm32 target     — compiles crates/pipeline
#   - wasm-bindgen-cli (pinned)  — must match the wasm-bindgen crate version
# Then installs npm deps. Re-running is safe (idempotent).
set -euo pipefail

# Keep this in sync with crates/pipeline/Cargo.toml (wasm-bindgen = "=X.Y.Z").
WB_VERSION=0.2.126

echo "[setup] installing binaryen (wasm-opt)"
sudo apt-get update -qq
sudo apt-get install -y binaryen

if [ ! -x "$HOME/.cargo/bin/rustup" ]; then
  echo "[setup] installing rustup"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs |
    sh -s -- -y --profile minimal --default-toolchain stable
fi
# shellcheck disable=SC1091
source "$HOME/.cargo/env"

echo "[setup] adding wasm32-unknown-unknown target"
rustup target add wasm32-unknown-unknown

current_wb=""
if command -v wasm-bindgen >/dev/null 2>&1; then
  current_wb="$(wasm-bindgen --version | awk '{print $2}')"
fi
if [ "$current_wb" != "$WB_VERSION" ]; then
  echo "[setup] installing wasm-bindgen-cli $WB_VERSION"
  tarball="wasm-bindgen-${WB_VERSION}-x86_64-unknown-linux-musl"
  curl -sSL "https://github.com/rustwasm/wasm-bindgen/releases/download/${WB_VERSION}/${tarball}.tar.gz" |
    tar xz -C /tmp
  mv "/tmp/${tarball}/wasm-bindgen" "$HOME/.cargo/bin/"
fi

echo "[setup] installing npm dependencies"
npm ci

echo "[setup] done — run 'npm run build' or 'npm run dev'"
