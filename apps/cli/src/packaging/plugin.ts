import type { GenerationContext, HexkitPlugin } from "@hexkit/plugin-api";
import { APICAL_CONTRACT_ARTIFACT } from "@hexkit/plugin-apical";
import { PERSISTENCE_ARTIFACT } from "@hexkit/plugin-drizzle";
import { HTTP_ARTIFACT } from "@hexkit/plugin-hono";
import { NEXT_HTTP_ARTIFACT } from "@hexkit/plugin-next";

import { buildHonoPackagingPlan, buildNextPackagingPlan } from "./model/plan.ts";
import { renderPackagingFiles } from "./render/files.ts";

export function createPackagingPlugin(options: { http?: "hono" | "next" } = {}): HexkitPlugin {
  return {
    name: "packaging",
    generate(context: GenerationContext) {
      const contract = context.artifacts.require(APICAL_CONTRACT_ARTIFACT);
      const persistence = context.artifacts.require(PERSISTENCE_ARTIFACT);
      const plan =
        options.http === "next"
          ? buildNextPackagingPlan({
              contract,
              nextHttp: context.artifacts.require(NEXT_HTTP_ARTIFACT),
              persistence,
            })
          : buildHonoPackagingPlan({
              contract,
              http: context.artifacts.require(HTTP_ARTIFACT),
              persistence,
            });

      for (const file of renderPackagingFiles(plan)) {
        context.writeFile(file);
      }
    },
  };
}
