import { describe, expect, it } from "vite-plus/test";

import { toKebabCase } from "@hexkit/codegen";
import { runPipeline } from "@hexkit/core";
import { APICAL_CONTRACT_ARTIFACT, type ContractArtifact } from "@hexkit/plugin-apical";
import { createSeededLibraryContract } from "@hexkit/plugin-apical/testing";
import { createHexagonalPlugin } from "@hexkit/plugin-architecture-hexagonal";
import { createDrizzlePlugin } from "@hexkit/plugin-drizzle";
import { createHonoPlugin } from "@hexkit/plugin-hono";
import type { HexkitPlugin } from "@hexkit/plugin-api";

function createContractPublisher(contract: ContractArtifact): HexkitPlugin {
  return {
    name: "contract-fixture",
    generate(context) {
      context.artifacts.publish(APICAL_CONTRACT_ARTIFACT, contract);
    },
  };
}

describe("Given a seeded library-shaped ContractArtifact", () => {
  it("when the default plugins run without craft, then generated files follow the nouns", async () => {
    const sample = createSeededLibraryContract(Date.now() >>> 0);
    const { parent, child, seed } = sample.nouns;
    const { collectionPath, honoItemPath, parentTable, childTable } = sample.names;
    const outputDirectory = "/tmp/hexkit-random-contract";
    const written = new Map<string, string>();

    await runPipeline(
      {
        inputPath: "openapi.yaml",
        outputDirectory,
        plugins: [
          createContractPublisher(sample.contract),
          createHexagonalPlugin(),
          createHonoPlugin(),
          createDrizzlePlugin(),
        ],
      },
      {
        exists: () => false,
        write(path, contents) {
          written.set(path.slice(outputDirectory.length + 1), contents);
        },
        log() {},
      },
    );

    const source = [...written.values()].join("\n");
    const paths = [...written.keys()];

    expect({
      seed,
      parentDomain: paths.includes(`src/core/domain/${toKebabCase(parent)}.ts`),
      childDomain: paths.includes(`src/core/domain/${toKebabCase(child)}.ts`),
      createRoute: source.includes(`app.post("${collectionPath}", async (context) =>`),
      getRoute: source.includes(`app.get("${honoItemPath}", async (context) =>`),
      parentTable: source.includes(`pgTable("${parentTable}"`),
      childTable: source.includes(`pgTable("${childTable}"`),
    }).toEqual({
      seed,
      parentDomain: true,
      childDomain: true,
      createRoute: true,
      getRoute: true,
      parentTable: true,
      childTable: true,
    });
    expect(source).not.toMatch(/\bPet\b|\bOrder\b|\bAuthor\b|\bBook\b|petstore|addPet/);
  });
});
