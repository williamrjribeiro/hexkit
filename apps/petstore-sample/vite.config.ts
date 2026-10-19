import { defineConfig } from "vite-plus";

export default defineConfig({
  // Pactum acceptance suites share one Compose database, and inventory asserts
  // exact count deltas — run test files sequentially so other files' pet seeds
  // cannot land between its two inventory reads.
  test: {
    fileParallelism: false,
  },
  pack: {
    dts: {
      tsgo: {},
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
