import { APICAL_CONTRACT_ARTIFACT } from "@hexkit/plugin-apical";
import { APPLICATION_ARTIFACT } from "@hexkit/plugin-architecture-hexagonal";
import type { GenerationContext, HexkitPlugin } from "@hexkit/plugin-api";

import { NEXT_HTTP_ARTIFACT, type NextSurface } from "./artifact.ts";
import { generateNextDalFromArtifacts } from "./generate/files.ts";

export type NextPluginOptions = {
  surface?: NextSurface;
};

export function createNextPlugin(options?: NextPluginOptions): HexkitPlugin {
  return {
    name: "next",
    generate(context: GenerationContext) {
      const contract = context.artifacts.require(APICAL_CONTRACT_ARTIFACT);
      const application = context.artifacts.require(APPLICATION_ARTIFACT);
      const { files, artifact } = generateNextDalFromArtifacts(contract, application, {
        surface: options?.surface ?? "both",
      });

      for (const file of files) {
        context.writeFile(file);
      }

      context.artifacts.publish(NEXT_HTTP_ARTIFACT, artifact);
    },
  };
}
