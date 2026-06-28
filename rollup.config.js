import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import serve from "rollup-plugin-serve";
import livereload from "rollup-plugin-livereload";

const dev = process.env.ROLLUP_WATCH === "true";

// Copy locale dictionaries next to the bundle (dist/locales/) so i18n fetches the
// active one at runtime instead of bundling all of them.
function copyLocales() {
  const src = "src/i18n/locales";
  const out = "dist/locales";
  return {
    name: "copy-locales",
    buildStart() {
      for (const f of readdirSync(src)) {
        if (f.endsWith(".json")) this.addWatchFile(resolvePath(src, f));
      }
    },
    writeBundle() {
      mkdirSync(out, { recursive: true });
      for (const f of readdirSync(src)) {
        if (f.endsWith(".json")) copyFileSync(resolvePath(src, f), resolvePath(out, f));
      }
    },
  };
}

export default {
  input: {
    bundle: "src/index.ts",
    colorWorker: "src/domain/colorWorker.ts",
  },
  output: {
    dir: "dist",
    format: "es",
    entryFileNames: "[name].js",
    chunkFileNames: "chunks/[name]-[hash].js",
    sourcemap: dev,
  },
  plugins: [
    copyLocales(),
    resolve(),
    commonjs(),
    json(),
    typescript({ tsconfig: "./tsconfig.json" }),
    !dev &&
      terser({
        compress: {
          passes: 3,
          pure_getters: true,
          unsafe_arrows: true,
          unsafe_methods: true,
        },
        mangle: {
          properties: {
            regex: /^#/,
          },
        },
        format: {
          comments: false,
        },
      }),
    dev &&
      serve({
        contentBase: ".",
        open: false,
        port: 3000,
        host: "0.0.0.0",
      }),
    dev && livereload({ watch: "dist" }),
  ],
};
