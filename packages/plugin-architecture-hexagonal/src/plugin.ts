import { APICAL_CONTRACT_ARTIFACT } from "@hexkit/plugin-apical";
import type { GenerationContext, HexkitPlugin } from "@hexkit/plugin-api";

import { APPLICATION_ARTIFACT } from "./artifact.ts";
import { generateApplicationFromContract } from "./generate/files.ts";

export function createHexagonalPlugin(): HexkitPlugin {
  return {
    name: "architecture-hexagonal",
    generate(context: GenerationContext) {
      const contract = context.artifacts.require(APICAL_CONTRACT_ARTIFACT);
      const { files, artifact } = generateApplicationFromContract(contract);

      for (const file of files) {
        context.writeFile(file);
      }

      context.artifacts.publish(APPLICATION_ARTIFACT, artifact);
    },
  };
}
