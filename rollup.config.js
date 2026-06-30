import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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

// Concatenate the split stylesheets (src/styles/) into a single dist/styles.css.
// CSS is a static asset - Rollup does not process it, this only assembles the parts
// in cascade order and ships the result next to the bundle. The order is explicit
// because the cascade depends on it (tokens/reset first, then per-region styles).
function bundleStyles() {
  const src = "src/styles";
  const order = [
    "tokens.css",
    "topbar.css",
    "stage.css",
    "rail.css",
    "panel.css",
    "stack.css",
    "help.css",
  ];
  return {
    name: "bundle-styles",
    buildStart() {
      for (const f of order) this.addWatchFile(resolvePath(src, f));
    },
    writeBundle() {
      const css = order.map((f) => readFileSync(resolvePath(src, f), "utf8")).join("\n");
      mkdirSync("dist", { recursive: true });
      writeFileSync(resolvePath("dist", "styles.css"), css);
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
    bundleStyles(),
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
