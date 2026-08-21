import { describe, expect, it } from "vite-plus/test";

import type { ContractArtifact } from "@hexkit/plugin-apical";
import type { PersistenceArtifact } from "@hexkit/plugin-drizzle";
import type { HttpArtifact } from "@hexkit/plugin-hono";
import type { NextHttpArtifact } from "@hexkit/plugin-next";

import { generateNextPackagingFiles, generatePackagingFiles } from "./files.ts";

function catalogContract(): ContractArtifact {
  return {
    artifactVersion: 1,
    openapiVersion: "3.1.0",
    application: {
      title: "Catalog API",
      version: "1.0.0",
      slug: "catalog-api",
    },
    schemas: [],
    securitySchemes: [],
    globalSecurity: [],
    operations: [],
  };
}

function catalogPersistence(): PersistenceArtifact {
  return {
    artifactVersion: 1,
    schemaFilePath: "src/adapters/db/schema.ts",
    mapperFilePath: "src/adapters/db/mappers.ts",
    migrationPath: "drizzle/0000_catalog-api.sql",
    tables: [],
    mappers: [],
    repositories: [
      {
        aggregate: "Item",
        portName: "ItemRepository",
        factoryName: "createDrizzleItemRepository",
        filePath: "src/adapters/db/item-repository.ts",
        runtimeKey: "items",
      },
    ],
  };
}

describe("Given packaging file calculations", () => {
  it("when Hono files are generated, then the public wrapper emits the server entry", () => {
    const http: HttpArtifact = {
      artifactVersion: 1,
      controllersFilePath: "src/adapters/http/controllers.ts",
      routesFilePath: "src/adapters/http/routes.ts",
      runtimeFilePath: "src/runtime/app.ts",
      createAppFactoryName: "createApp",
      createHonoAppFactoryName: "createHonoApp",
      runtimeRepositoriesTypeName: "RuntimeRepositories",
      repositories: [
        {
          parameterName: "items",
          repositoryName: "ItemRepository",
          repositoryFilePath: "src/core/ports/item-repository.ts",
        },
      ],
      operations: [],
    };

    const files = generatePackagingFiles({
      contract: catalogContract(),
      http,
      persistence: catalogPersistence(),
    });

    expect(files.map((file) => file.path)).toContain("src/runtime/server.ts");
  });

  it("when Next files are generated, then the public wrapper emits the database helper", () => {
    const nextHttp: NextHttpArtifact = {
      artifactVersion: 1,
      surface: "routes",
      serverAccessFilePath: "src/adapters/http-next/server-access.ts",
      routes: [],
      uiPages: [],
      repositories: [
        {
          aggregate: "Item",
          name: "ItemRepository",
          filePath: "src/core/ports/item-repository.ts",
          parameterName: "items",
          methods: [],
        },
      ],
    };

    const files = generateNextPackagingFiles({
      contract: catalogContract(),
      nextHttp,
      persistence: catalogPersistence(),
    });

    expect(files.map((file) => file.path)).toContain("src/adapters/db/database.ts");
  });
});
