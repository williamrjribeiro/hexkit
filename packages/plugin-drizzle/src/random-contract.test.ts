import { describe, expect, it } from "vite-plus/test";

import { toKebabCase, toSnakeCase } from "@hexkit/codegen";
import { APICAL_CONTRACT_ARTIFACT, type ContractArtifact } from "@hexkit/plugin-apical";
import { createSeededLibraryContract } from "@hexkit/plugin-apical/testing";
import {
  APPLICATION_ARTIFACT,
  deriveApplicationModel,
  toApplicationArtifact,
} from "@hexkit/plugin-architecture-hexagonal";
import { type GeneratedFile } from "@hexkit/plugin-api";
import { collectPluginOutput } from "@hexkit/shared/testing";

import { createDrizzlePlugin } from "./plugin.ts";

async function collectGeneratedFiles(contract: ContractArtifact): Promise<GeneratedFile[]> {
  const { files } = await collectPluginOutput(createDrizzlePlugin(), (context) => {
    context.artifacts.publish(APICAL_CONTRACT_ARTIFACT, contract);
    context.artifacts.publish(
      APPLICATION_ARTIFACT,
      toApplicationArtifact(deriveApplicationModel(contract)),
    );
  });
  return files;
}

describe("Given a seeded library-shaped ContractArtifact", () => {
  it("when the Drizzle plugin runs, then tables and the FK follow the nouns", async () => {
    const sample = createSeededLibraryContract(Date.now() >>> 0);
    const { child, seed } = sample.nouns;
    const { parentTable, childTable, parentId } = sample.names;
    const files = await collectGeneratedFiles(sample.contract);
    const source = files.map((file) => file.contents).join("\n");
    const slug = sample.contract.application.slug;

    expect({
      seed,
      schema:
        source.includes(`pgTable("${parentTable}"`) && source.includes(`pgTable("${childTable}"`),
      fk: source.includes(`.references(() => ${parentTable}.id)`),
      sql: source.includes(
        `FOREIGN KEY ("${toSnakeCase(parentId)}") REFERENCES "public"."${parentTable}"("id")`,
      ),
      repository: files.some(
        (file) => file.path === `src/adapters/db/${toKebabCase(child)}-repository.ts`,
      ),
      migration: files.some((file) => file.path === `drizzle/0000_${slug}.sql`),
    }).toEqual({
      seed,
      schema: true,
      fk: true,
      sql: true,
      repository: true,
      migration: true,
    });
    expect(source).not.toMatch(/\bPet\b|\bOrder\b|\bAuthor\b|\bBook\b|petstore|addPet/);
  });
});
