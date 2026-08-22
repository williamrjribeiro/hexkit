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
} from "@hexkit/plugin-api";

import { createHonoPlugin } from "./plugin.ts";

async function collectGeneratedFiles(contract: ContractArtifact): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];
  const context: GenerationContext = {
    inputPath: "openapi.yaml",
    outputDirectory: "/tmp/generated-app",
    artifacts: createArtifactRegistry(),
    writeFile(file: GeneratedFile) {
      files.push(file);
    },
    log() {},
  };

  const { artifact: application } = generateApplicationFromContract(contract);
  context.artifacts.publish(APICAL_CONTRACT_ARTIFACT, contract);
  context.artifacts.publish(APPLICATION_ARTIFACT, application);
  await createHonoPlugin().generate(context);
  return files;
}

describe("Given a seeded library-shaped ContractArtifact", () => {
  it("when Hono generation runs, then routes follow the nouns", async () => {
    const sample = createSeededLibraryContract(Date.now() >>> 0);
    const { seed } = sample.nouns;
    const { collectionPath, honoItemPath, createOperationId, getOperationId, childTable } =
      sample.names;
    const files = await collectGeneratedFiles(sample.contract);
    const source = files.map((file) => file.contents).join("\n");

    expect({
      seed,
      createRoute: source.includes(`app.post("${collectionPath}", async (context) =>`),
      getRoute: source.includes(`app.get("${honoItemPath}", async (context) =>`),
      createRuntime: source.includes(`${createOperationId}:`),
      getRuntime: source.includes(`${getOperationId}:`),
      repository: source.includes(`${childTable}:`),
    }).toEqual({
      seed,
      createRoute: true,
      getRoute: true,
      createRuntime: true,
      getRuntime: true,
      repository: true,
    });
    expect(source).not.toMatch(/\bPet\b|\bOrder\b|\bAuthor\b|\bBook\b|petstore|addPet/);
  });
});
