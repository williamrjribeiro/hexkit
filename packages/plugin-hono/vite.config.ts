import { defineConfig } from "vite-plus";
import { hexkitTest } from "../../coverage.config.ts";

export default defineConfig({
  pack: {
    dts: {
      tsgo: {},
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
