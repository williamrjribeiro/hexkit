import { defineConfig } from "vite-plus";
import { hexkitCoverage } from "../../coverage.config.ts";

export default defineConfig({
  pack: {
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
  test: {
    coverage: hexkitCoverage,
  },
});
