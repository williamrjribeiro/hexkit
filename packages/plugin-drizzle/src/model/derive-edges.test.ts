import { describe, expect, it } from "vite-plus/test";

import type { ContractArtifact } from "@hexkit/plugin-apical";
import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";

import { derivePersistenceModel, toPersistenceArtifact } from "./derive.ts";

function emptyApplication(
  repositories: ApplicationArtifact["repositories"] = [],
): ApplicationArtifact {
  return {
    artifactVersion: 1,
    entities: [],
    repositories,
    useCases: [],
  };
}

function baseContract(
  slug: string,
  schemas: ContractArtifact["schemas"],
  operations: ContractArtifact["operations"] = [],
): ContractArtifact {
  return {
    artifactVersion: 1,
    openapiVersion: "3.1.0",
    application: { title: slug, version: "1.0.0", slug },
    schemas,
    securitySchemes: [],
    globalSecurity: [],
    operations,
  };
}

describe("derivePersistenceModel leftover orchestrator cases", () => {
  it("when schemas declare persistence, then it composes ordered tables, enums, and artifact paths", () => {
    const contract = baseContract("widget-api", [
      {
        name: "Widget",
        modulePath: "schemas/Widget.ts",
        persistence: { table: "widgets", identity: "id" },
        properties: [
          {
            name: "id",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
          },
          {
            name: "status",
            required: true,
            type: { kind: "string", nullable: false, enum: ["open", "closed"] },
          },
        ],
      },
    ]);

    const model = derivePersistenceModel(contract, emptyApplication());
    expect(model.applicationSlug).toBe("widget-api");
    expect(model.migrationPath).toBe("drizzle/0000_widget-api.sql");
    expect(model.tables.map((table) => table.schemaName)).toEqual(["Widget"]);
    expect(model.enums).toEqual([
      {
        exportName: "widgetStatus",
        sqlName: "widget_status",
        values: ["open", "closed"],
      },
    ]);
    expect(model.repositories).toEqual([]);

    expect(toPersistenceArtifact(model)).toMatchObject({
      artifactVersion: 1,
      schemaFilePath: "src/adapters/db/schema.ts",
      mapperFilePath: "src/adapters/db/mappers.ts",
      migrationPath: "drizzle/0000_widget-api.sql",
      tables: [{ schemaName: "Widget", exportName: "widgets", tableName: "widgets" }],
      mappers: [
        {
          entityName: "Widget",
          functionName: "mapWidgetRow",
          filePath: "src/adapters/db/mappers.ts",
        },
      ],
      repositories: [],
    });
  });
});
