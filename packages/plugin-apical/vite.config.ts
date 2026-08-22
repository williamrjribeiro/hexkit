import { defineConfig } from "vite-plus";
import { hexkitTest } from "../../coverage.config.ts";

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      testing: "src/testing.ts",
    },
    dts: {
      tsgo: true,
    },
    exports: false,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
  test: hexkitTest(import.meta.dirname),
});
