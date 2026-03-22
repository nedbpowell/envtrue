import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts", "nextjs.ts", "vite.ts", "hono.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: "node18",
  platform: "neutral",
  outDir: "dist"
});
