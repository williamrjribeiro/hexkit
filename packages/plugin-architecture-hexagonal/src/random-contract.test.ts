import { describe, expect, it } from "vite-plus/test";

import { toKebabCase } from "@hexkit/codegen";
import { APICAL_CONTRACT_ARTIFACT, type ContractArtifact } from "@hexkit/plugin-apical";
import { createSeededLibraryContract } from "@hexkit/plugin-apical/testing";
import {
  createArtifactRegistry,
  type GeneratedFile,
  type GenerationContext,
} from "@hexkit/plugin-api";

import { createHexagonalPlugin } from "./plugin.ts";

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

  context.artifacts.publish(APICAL_CONTRACT_ARTIFACT, contract);
  await createHexagonalPlugin().generate(context);
  return files;
}

describe("Given a seeded library-shaped ContractArtifact", () => {
  it("when the hexagonal plugin runs, then domain files and use cases follow the nouns", async () => {
    const sample = createSeededLibraryContract(Date.now() >>> 0);
    const { parent, child, seed } = sample.nouns;
    const { createOperationId, getOperationId } = sample.names;
    const files = await collectGeneratedFiles(sample.contract);
    const paths = files.map((file) => file.path);
    const source = files.map((file) => file.contents).join("\n");

    expect({
      seed,
      paths,
    }).toEqual({
      seed,
      paths: [
        ...[
          `src/core/domain/${toKebabCase(parent)}.ts`,
          `src/core/domain/${toKebabCase(child)}.ts`,
        ].toSorted(),
        `src/core/ports/${toKebabCase(child)}-repository.ts`,
        `src/core/application/${toKebabCase(createOperationId)}.ts`,
        `src/core/application/${toKebabCase(getOperationId)}.ts`,
      ],
    });
    expect(source).toContain(`export type ${parent} = {`);
    expect(source).toContain(`export type ${child} = {`);
    expect(source).toContain(`export interface ${child}Repository {`);
    expect(source).not.toMatch(/\bPet\b|\bOrder\b|\bAuthor\b|\bBook\b|petstore|addPet/);
  });
});
