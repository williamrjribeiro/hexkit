import { join } from "node:path";

import type { GenerationContext, HexkitPlugin } from "@hexkit/plugin-api";

import { generateContracts, type CraftRunner } from "./generate-contracts.ts";

export function createApicalPlugin(runCraft?: CraftRunner): HexkitPlugin {
  return {
    name: "apical",
    generate(context: GenerationContext) {
      generateContracts(
        {
          input: context.inputPath,
          output: join(context.outputDirectory, "src/generated/contracts"),
          server: true,
          routes: true,
        },
        runCraft,
      );
    },
  };
}
