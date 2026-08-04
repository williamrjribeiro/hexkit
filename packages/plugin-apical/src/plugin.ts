import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { GenerationContext, HexkitPlugin } from "@hexkit/plugin-api";

import {
  APICAL_CONTRACT_ARTIFACT,
  inspectGeneratedIndexes,
  loadValidatedOpenApi,
  normalizeContractArtifact,
  type OpenApiLoader,
} from "./contract/index.ts";
import { generateContracts, type CraftRunner } from "./generate-contracts.ts";

export type GeneratedFileReader = (path: string) => Promise<string>;

export type ApicalPluginOptions = {
  runCraft?: CraftRunner;
  loadOpenApi?: OpenApiLoader;
  readGeneratedFile?: GeneratedFileReader;
};

const readGeneratedFile: GeneratedFileReader = (path) => readFile(path, "utf8");

export function createApicalPlugin(options: ApicalPluginOptions = {}): HexkitPlugin {
  return {
    name: "apical",
    async generate(context: GenerationContext) {
      const contractsDirectory = join(context.outputDirectory, "src/generated/contracts");

      await generateContracts(
        {
          input: context.inputPath,
          output: contractsDirectory,
          server: true,
          routes: true,
        },
        options.runCraft,
      );

      const openApi = await (options.loadOpenApi ?? loadValidatedOpenApi)(context.inputPath);
      const readIndex = options.readGeneratedFile ?? readGeneratedFile;
      const [schemasIndex, routesIndex] = await Promise.all([
        readIndex(join(contractsDirectory, "schemas/index.ts")),
        readIndex(join(contractsDirectory, "routes/index.ts")),
      ]);
      const artifact = normalizeContractArtifact(
        openApi,
        inspectGeneratedIndexes(schemasIndex, routesIndex),
      );

      context.artifacts.publish(APICAL_CONTRACT_ARTIFACT, artifact);
      context.writeFile({
        path: "src/generated/contracts/hexkit-contract.json",
        contents: `${JSON.stringify(artifact, null, 2)}\n`,
        ownership: "generated",
      });
    },
  };
}
