import { APICAL_CONTRACT_ARTIFACT } from "@hexkit/plugin-apical";
import { APPLICATION_ARTIFACT } from "@hexkit/plugin-architecture-hexagonal";
import type { GenerationContext, HexkitPlugin } from "@hexkit/plugin-api";

import { HTTP_ARTIFACT } from "./artifact.ts";
import { generateHttpFromArtifacts } from "./generate/files.ts";

export function createHonoPlugin(): HexkitPlugin {
  return {
    name: "hono",
    generate(context: GenerationContext) {
      const contract = context.artifacts.require(APICAL_CONTRACT_ARTIFACT);
      const application = context.artifacts.require(APPLICATION_ARTIFACT);
      const { files, artifact } = generateHttpFromArtifacts(contract, application);

      for (const file of files) {
        context.writeFile(file);
      }

      context.artifacts.publish(HTTP_ARTIFACT, artifact);
    },
  };
}
