import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import livereload from "rollup-plugin-livereload";
import serve from "rollup-plugin-serve";

const isDevelopment = process.env.ROLLUP_WATCH === "true";

// Copy locale dictionaries next to the bundle (dist/locales/) so i18n fetches the
// active one at runtime instead of bundling all of them.
function copyLocales() {
  const sourceDirectory = "src/i18n/locales";
  const outputDirectory = "dist/locales";
  return {
    name: "copy-locales",
    buildStart() {
      for (const fileName of readdirSync(sourceDirectory)) {
        if (fileName.endsWith(".json")) this.addWatchFile(resolvePath(sourceDirectory, fileName));
      }
    },
    writeBundle() {
      mkdirSync(outputDirectory, { recursive: true });
      for (const fileName of readdirSync(sourceDirectory)) {
        if (fileName.endsWith(".json")) {
          copyFileSync(
            resolvePath(sourceDirectory, fileName),
            resolvePath(outputDirectory, fileName),
          );
        }
      }
    },
  };
}

// Concatenate the split stylesheets (src/styles/) into a single dist/styles.css.
// CSS is a static asset - Rollup does not process it, this only assembles the parts
// in cascade order and ships the result next to the bundle. The order is explicit
// because the cascade depends on it (tokens/reset first, then per-region styles).
function bundleStyles() {
  const sourceDirectory = "src/styles";
  const cascadeOrder = [
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
      for (const fileName of cascadeOrder)
        this.addWatchFile(resolvePath(sourceDirectory, fileName));
    },
    writeBundle() {
      const combinedCss = cascadeOrder
        .map((fileName) => readFileSync(resolvePath(sourceDirectory, fileName), "utf8"))
        .join("\n");
      mkdirSync("dist", { recursive: true });
      writeFileSync(resolvePath("dist", "styles.css"), combinedCss);
    },
  };
}

export default {
  input: {
    bundle: "src/index.ts",
    colorWorker: "src/domain/colorWorker.ts",
    pipelineWorker: "src/domain/pipelineWorker.ts",
  },
  output: {
    dir: "dist",
    format: "es",
    entryFileNames: "[name].js",
    chunkFileNames: "chunks/[name]-[hash].js",
    sourcemap: isDevelopment,
  },
  plugins: [
    copyLocales(),
    bundleStyles(),
    resolve(),
    commonjs(),
    json(),
    typescript({ tsconfig: "./tsconfig.json" }),
    !isDevelopment &&
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
    isDevelopment &&
      serve({
        contentBase: ".",
        open: false,
        port: 3000,
        host: "0.0.0.0",
      }),
    isDevelopment && livereload({ watch: "dist" }),
  ],
};
