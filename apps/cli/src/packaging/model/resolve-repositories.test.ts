import { describe, expect, it } from "vite-plus/test";

import type { PersistenceArtifact } from "@hexkit/plugin-drizzle";

import { resolveRuntimeRepositories } from "./resolve-repositories.ts";

function persistenceWithKeys(...runtimeKeys: string[]): PersistenceArtifact {
  return {
    artifactVersion: 1,
    schemaFilePath: "src/adapters/db/schema.ts",
    mapperFilePath: "src/adapters/db/mappers.ts",
    migrationPath: "drizzle/0000.sql",
    tables: [],
    mappers: [],
    repositories: runtimeKeys.map((runtimeKey) => ({
      aggregate: runtimeKey,
      portName: `${runtimeKey}Repository`,
      factoryName: `createDrizzle${runtimeKey}Repository`,
      filePath: `src/adapters/db/${runtimeKey}-repository.ts`,
      runtimeKey,
    })),
  };
}

describe("Given HTTP and persistence repository keys", () => {
  const labels = ["HttpArtifact", "NextHttpArtifact"] as const;

  for (const httpLabel of labels) {
    it(`when persistence has a key missing from ${httpLabel}, then it throws`, () => {
      expect(() =>
        resolveRuntimeRepositories({
          httpKeys: new Set(["items"]),
          persistence: persistenceWithKeys("animals"),
          httpLabel,
        }),
      ).toThrow(
        `PersistenceArtifact repository runtime key "animals" is missing from ${httpLabel} repositories.`,
      );
    });

    it(`when ${httpLabel} has a key without a persistence factory, then it throws`, () => {
      expect(() =>
        resolveRuntimeRepositories({
          httpKeys: new Set(["items", "carts"]),
          persistence: persistenceWithKeys("items"),
          httpLabel,
        }),
      ).toThrow(
        `${httpLabel} repository parameter "carts" has no PersistenceArtifact factory binding.`,
      );
    });
  }

  it("when keys match, then bindings are returned sorted by runtime key", () => {
    expect(
      resolveRuntimeRepositories({
        httpKeys: new Set(["items", "carts"]),
        persistence: persistenceWithKeys("items", "carts"),
        httpLabel: "HttpArtifact",
      }),
    ).toEqual([
      {
        runtimeKey: "carts",
        factoryName: "createDrizzlecartsRepository",
        filePath: "src/adapters/db/carts-repository.ts",
      },
      {
        runtimeKey: "items",
        factoryName: "createDrizzleitemsRepository",
        filePath: "src/adapters/db/items-repository.ts",
      },
    ]);
  });
});
