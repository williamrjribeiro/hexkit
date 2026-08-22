import { describe, expect, it } from "vite-plus/test";

import { APICAL_CONTRACT_ARTIFACT, type ContractArtifact } from "@hexkit/plugin-apical";
import { createSeededLibraryContract } from "@hexkit/plugin-apical/testing";
import {
  APPLICATION_ARTIFACT,
  generateApplicationFromContract,
} from "@hexkit/plugin-architecture-hexagonal";
import {
  createArtifactRegistry,
  type GeneratedFile,
  type GenerationContext,
  type HexkitPlugin,
} from "@hexkit/plugin-api";

import { type NextSurface } from "./artifact.ts";

async function collectGeneratedFiles(
  contract: ContractArtifact,
  surface: NextSurface,
): Promise<GeneratedFile[]> {
  const application = generateApplicationFromContract(contract).artifact;
  const files: GeneratedFile[] = [];
  const context: GenerationContext = {
    inputPath: "openapi.yaml",
    outputDirectory: "/tmp/generated-next-app",
    artifacts: createArtifactRegistry(),
    writeFile(file: GeneratedFile) {
      files.push(file);
    },
    log() {},
  };
  const pluginModule = (await import("./plugin.ts")) as {
    createNextPlugin: (options?: { surface?: NextSurface }) => HexkitPlugin;
  };

  context.artifacts.publish(APICAL_CONTRACT_ARTIFACT, contract);
  context.artifacts.publish(APPLICATION_ARTIFACT, application);
  await pluginModule.createNextPlugin({ surface }).generate(context);
  return files;
}

describe("Given a seeded library-shaped ContractArtifact", () => {
  it("when Next generation runs, then App Router files follow the nouns", async () => {
    const sample = createSeededLibraryContract(Date.now() >>> 0);
    const { seed } = sample.nouns;
    const { childTable, childId, createOperationId, getOperationId } = sample.names;
    const files = await collectGeneratedFiles(sample.contract, "both");
    const paths = files.map((file) => file.path);
    const source = files.map((file) => file.contents).join("\n");

    expect({
      seed,
      collectionRoute: paths.includes(`app/${childTable}/route.ts`),
      itemRoute: paths.includes(`app/${childTable}/[${childId}]/route.ts`),
      uiPage: paths.includes(`app/ui/${childTable}/[${childId}]/page.tsx`),
    }).toEqual({
      seed,
      collectionRoute: true,
      itemRoute: true,
      uiPage: true,
    });
    expect(source).toContain(`${createOperationId}:`);
    expect(source).toContain(`${getOperationId}:`);
    expect(source).not.toMatch(/\bPet\b|\bOrder\b|\bAuthor\b|\bBook\b|petstore|addPet/);
  });
});
