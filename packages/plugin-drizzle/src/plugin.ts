import { APICAL_CONTRACT_ARTIFACT } from "@hexkit/plugin-apical";
import { APPLICATION_ARTIFACT } from "@hexkit/plugin-architecture-hexagonal";
import type { GenerationContext, HexkitPlugin } from "@hexkit/plugin-api";

import { PERSISTENCE_ARTIFACT } from "./artifact.ts";
import { generatePersistenceFromArtifacts } from "./generate/files.ts";

export function createDrizzlePlugin(): HexkitPlugin {
  return {
    name: "drizzle",
    generate(context: GenerationContext) {
      const contract = context.artifacts.require(APICAL_CONTRACT_ARTIFACT);
      const application = context.artifacts.require(APPLICATION_ARTIFACT);
      const { files, artifact } = generatePersistenceFromArtifacts(contract, application);

      for (const file of files) {
        context.writeFile(file);
      }

      context.artifacts.publish(PERSISTENCE_ARTIFACT, artifact);
    },
  };
}
