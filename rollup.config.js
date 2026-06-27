import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import serve from "rollup-plugin-serve";
import livereload from "rollup-plugin-livereload";

const dev = process.env.ROLLUP_WATCH === "true";

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
